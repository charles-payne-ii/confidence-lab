import base64, json, time
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

BASE='http://127.0.0.1:4189/confidence-lab/'
KEY='performance-lab:data'
USER='11111111-1111-4111-8111-111111111111'
OUT=Path('/tmp/confidence-cloud-checks');OUT.mkdir(exist_ok=True)
remote={};calls=[];fail=False
def b64(value): return base64.urlsafe_b64encode(json.dumps(value).encode()).decode().rstrip('=')
def session(user=USER):
    expires=int(time.time())+3600
    token=b64({'alg':'HS256','typ':'JWT'})+'.'+b64({'sub':user,'exp':expires,'role':'authenticated','aud':'authenticated'})+'.fixture'
    return {'access_token':token,'refresh_token':'browser-test-refresh','expires_at':expires,'expires_in':3600,'token_type':'bearer','user':{'id':user,'aud':'authenticated','role':'authenticated','email':'tester@example.com','created_at':'2026-10-12T10:00:00Z','app_metadata':{'provider':'email'},'user_metadata':{}}}
def handle(route):
    global fail
    request=route.request;url=request.url;body=request.post_data_json if request.post_data else None
    token=request.headers.get('authorization','').replace('Bearer ','')
    try: user=json.loads(base64.urlsafe_b64decode(token.split('.')[1]+'=='))['sub']
    except Exception: user=None
    calls.append({'url':url,'body':body,'user':user})
    if '/auth/v1/otp' in url: route.fulfill(status=200,json={});return
    if '/auth/v1/logout' in url: route.fulfill(status=204,body='');return
    if '/rest/v1/user_data' in url:
        row=remote.get(user)
        route.fulfill(status=200,json=[row] if row else []);return
    if '/rest/v1/rpc/save_user_data' in url:
        if fail: route.abort('internetdisconnected');return
        old=remote.get(user);rev=old['revision'] if old else 0
        if body['expected_revision']!=rev: route.fulfill(status=409,json={'code':'40001','message':'Cloud copy changed'});return
        row={'payload':body['new_payload'],'revision':rev+1,'updated_at':'2026-10-12T21:15:00.000Z'}
        remote[user]=row;route.fulfill(status=200,json=[row]);return
    route.fulfill(status=400,json={'message':'Unexpected test request'})
def nav(page,name):
    if not page.get_by_role('navigation').is_visible():page.get_by_role('button',name='Open menu',exact=True).click()
    page.get_by_role('navigation').get_by_role('button',name=name,exact=True).click()
def context(browser,signed=False):
    ctx=browser.new_context(viewport={'width':390,'height':844},reduced_motion='reduce')
    ctx.route('https://confidence-test.supabase.co/**',handle)
    if signed:
        ctx.add_init_script('localStorage.setItem("sb-confidence-test-auth-token",'+json.dumps(json.dumps(session()))+')')
    return ctx

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium')
    # Signed-out use transmits no entries. Email-only sign-in request is explicit.
    guest=context(browser);page=guest.new_page();page.goto(BASE,wait_until='networkidle')
    page.get_by_role('button',name='Start my day').click();nav(page,'Data & privacy')
    assert not calls,calls
    page.get_by_label('Email address').fill('tester@example.com')
    page.get_by_role('button',name='Email me a sign-in link').click()
    expect(page.get_by_text('Check your email and open the sign-in link',exact=False)).to_be_visible()
    assert len(calls)==1 and 'new_payload' not in calls[0]['body'],calls
    guest.close()
    # Fixture session represents the completion of email sign-in.
    ctx=context(browser,True);page=ctx.new_page();errors=[]
    page.on('pageerror',lambda error:errors.append(str(error)))
    page.goto(BASE,wait_until='networkidle');page.get_by_role('button',name='Start my day').click();nav(page,'Data & privacy')
    expect(page.get_by_role('button',name='Start cloud storage')).to_be_visible()
    assert not remote
    page.get_by_role('button',name='Start cloud storage').click()
    expect(page.get_by_text('Saved to your cloud account.',exact=True).last).to_be_visible()
    assert remote[USER]['revision']==1
    nav(page,'Home');page.get_by_role('button',name='Add a memory ›').click()
    page.get_by_label('Title',exact=True).fill('Led the discussion')
    page.get_by_role('button',name='Continue',exact=True).click()
    page.get_by_label('What happened',exact=True).fill('Asked one question, listened, and clarified the plan.')
    page.get_by_role('button',name='Continue',exact=True).click();page.get_by_role('button',name='Leadership',exact=True).click()
    page.get_by_role('button',name='Continue',exact=True).click();page.get_by_role('button',name='Calm',exact=True).click()
    page.get_by_role('button',name='Review memory').click();page.get_by_role('button',name='Add to Bank').click()
    page.get_by_role('button',name='Finish later').click()
    expect(page.get_by_text('Saved to your cloud account.',exact=True)).to_be_visible()
    assert remote[USER]['payload']['bank']['memories'][0]['title']=='Led the discussion'
    page.screenshot(path=str(OUT/'saved-cloud-mobile.png'),full_page=True)
    # Clear browser data and restore in a fresh authenticated context.
    ctx.close();ctx=context(browser,True);page=ctx.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(BASE,wait_until='networkidle')
    expect(page.get_by_role('heading',name='Build Confidence',exact=True)).to_be_visible()
    page.get_by_role('button',name='Open Confidence Bank',exact=True).click()
    expect(page.locator('.bank-list')).to_contain_text('Led the discussion')
    # Failed writes leave the browser data intact and visibly pending.
    fail=True
    page.locator('.bank-list article').first.get_by_role('button',name='View and edit').click();page.get_by_role('button',name='Edit',exact=True).click()
    page.get_by_label('Title',exact=True).fill('Stayed calm in the discussion')
    for _ in range(3):page.get_by_role('button',name='Continue',exact=True).click()
    page.get_by_role('button',name='Review memory').click();page.get_by_role('button',name='Save changes').click()
    expect(page.get_by_text('Cloud save failed.',exact=False)).to_be_visible()
    assert page.evaluate('(key)=>JSON.parse(localStorage.getItem(key)).bank.memories[0].title',KEY)=='Stayed calm in the discussion'
    assert remote[USER]['payload']['bank']['memories'][0]['title']=='Led the discussion'
    nav(page,'Data & privacy');page.screenshot(path=str(OUT/'failed-cloud-save.png'),full_page=True)
    fail=False;page.get_by_role('button',name='Retry cloud connection').click()
    expect(page.get_by_text('Saved to your cloud account.',exact=True).last).to_be_visible()
    assert remote[USER]['payload']['bank']['memories'][0]['title']=='Stayed calm in the discussion'
    # A concurrent edit triggers explicit reconciliation rather than overwriting.
    remote[USER]['revision']+=1;remote[USER]['payload']['bank']['memories'][0]['title']='Changed on another device'
    nav(page,'Confidence Bank');page.locator('.bank-list article').first.get_by_role('button',name='View and edit').click();page.get_by_role('button',name='Edit',exact=True).click()
    page.get_by_label('Title',exact=True).fill('Local conflicting edit')
    for _ in range(3):page.get_by_role('button',name='Continue',exact=True).click()
    page.get_by_role('button',name='Review memory').click();page.get_by_role('button',name='Save changes').click()
    expect(page.get_by_text('Another device changed your cloud copy.',exact=False)).to_be_visible()
    assert remote[USER]['payload']['bank']['memories'][0]['title']=='Changed on another device'
    nav(page,'Data & privacy');page.once('dialog',lambda d:d.accept());page.get_by_role('button',name='Use cloud copy',exact=True).click()
    expect(page.get_by_role('heading',name='Build Confidence',exact=True)).to_be_visible()
    assert page.evaluate('(key)=>JSON.parse(localStorage.getItem(key)).bank.memories[0].title',KEY)=='Changed on another device'
    nav(page,'Data & privacy');page.get_by_role('button',name='Sign out',exact=True).click()
    expect(page.get_by_role('button',name='Email me a sign-in link')).to_be_visible()
    assert not errors,errors
    browser.close()
print('Cloud browser checks passed using simulated auth/service: email-only consent, first upload confirmation, autosave, fresh-browser restoration, failed-write retention/retry, concurrent conflict resolution, sign-out. Live email and hosted service were not tested.')

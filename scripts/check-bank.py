import json
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

BASE = 'http://127.0.0.1:4188/confidence-lab/'
KEY = 'performance-lab:data'
OUT = Path('/tmp/confidence-bank-checks')
OUT.mkdir(exist_ok=True)

def stored(page): return page.evaluate('(key)=>JSON.parse(localStorage.getItem(key))', KEY)
def nav(page, name):
    if not page.get_by_role('navigation').is_visible(): page.get_by_role('button',name='Open menu',exact=True).click()
    page.get_by_role('navigation').get_by_role('button',name=name,exact=True).click()
def capture(page, title, n):
    expect(page.get_by_role('button',name='Continue',exact=True)).to_be_disabled()
    page.get_by_label('Title',exact=True).fill(title)
    page.get_by_role('button',name='Success',exact=True).click()
    page.screenshot(path=str(OUT/f'capture-title-{n}.png'),full_page=True)
    page.get_by_role('button',name='Continue',exact=True).click()
    page.get_by_label('What happened',exact=True).fill('I paused, checked the figures, and answered the question with evidence.')
    page.get_by_role('button',name='Continue',exact=True).click()
    page.get_by_role('button',name='Preparation',exact=True).click()
    expect(page.get_by_role('button',name='Preparation',exact=True)).to_have_attribute('aria-pressed','true')
    page.get_by_role('button',name='Continue',exact=True).click()
    page.get_by_role('button',name='Calm',exact=True).click()
    page.get_by_role('button',name='Proud',exact=True).click()
    page.get_by_label('In your own words (optional)').fill('Still unsure')
    page.get_by_role('button',name='Review memory',exact=True).click()
    expect(page.locator('.memory-review-card')).to_contain_text('Still unsure')
    page.screenshot(path=str(OUT/f'capture-confirm-{n}.png'),full_page=True)
    page.get_by_role('button',name='Add to Bank',exact=True).click()
    assert len(stored(page)['bank']['memories']) == n

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True,executable_path='/usr/bin/chromium')
    ctx = browser.new_context(viewport={'width':390,'height':844},color_scheme='light',accept_downloads=True,reduced_motion='reduce')
    page = ctx.new_page(); errors=[]; external=[]; failures=[]
    page.on('pageerror',lambda e: errors.append(str(e)))
    page.on('request',lambda r: external.append(r.url) if not r.url.startswith('http://127.0.0.1:4188') and not r.url.startswith('blob:') else None)
    page.on('response',lambda r: failures.append(r.url) if r.status>=400 else None)
    page.goto(BASE,wait_until='networkidle')
    expect(page.get_by_role('heading',name='Build your Confidence Bank')).to_be_visible()
    expect(page.locator('html')).to_have_attribute('data-theme','dark')
    expect(page.locator('.bank-intro')).to_have_class('bank-frame bank-dark bank-intro')
    page.screenshot(path=str(OUT/'intro-mobile.png'),full_page=True)
    assert stored(page)['bank']['memories']==[]
    page.get_by_role('button',name='Start my day',exact=True).click()
    page.reload(wait_until='networkidle')
    expect(page.get_by_role('heading',name='Build Confidence',exact=True)).to_be_visible()
    expect(page.locator('html')).to_have_attribute('data-theme','dark')
    page.get_by_role('button',name='Open menu',exact=True).click()
    page.get_by_role('button',name='Switch to light mode').click()
    page.get_by_role('navigation').get_by_role('button',name='Home',exact=True).click()
    page.reload(wait_until='networkidle')
    expect(page.locator('html')).to_have_attribute('data-theme','light')
    page.get_by_role('button',name='Add a memory ›',exact=True).click()
    for n in range(1,4):
        capture(page,f'Answered the difficult question {n}',n)
        if n<3: page.get_by_role('button',name='Add another',exact=True).click()
    expect(page.get_by_role('heading',name='Your Confidence Bank is ready.')).to_be_visible()
    page.screenshot(path=str(OUT/'foundation-mobile.png'),full_page=True)
    page.get_by_role('button',name='Start my day',exact=True).click()
    assert page.locator('.bank-band .pillar-tier.filled').count()==3
    page.screenshot(path=str(OUT/'home-mobile.png'),full_page=True)
    page.get_by_role('button',name='Open Confidence Bank',exact=True).click()
    page.locator('.bank-list article').first.get_by_role('button',name='View and edit').click()
    expect(page.get_by_role('button',name='Save changes',exact=True)).to_be_visible()
    page.get_by_role('button',name='Edit',exact=True).click()
    page.get_by_label('Title',exact=True).fill('Kept going after a hard question')
    for _ in range(3): page.get_by_role('button',name='Continue',exact=True).click()
    page.get_by_role('button',name='Review memory',exact=True).click()
    page.get_by_role('button',name='Save changes',exact=True).click()
    assert stored(page)['bank']['memories'][0]['title']=='Kept going after a hard question'
    page.reload(wait_until='networkidle')
    expect(page.locator('.bank-list')).to_contain_text('Kept going after a hard question')
    page.once('dialog',lambda d: d.accept())
    page.locator('.bank-list article').last.get_by_role('button',name='Delete',exact=True).click()
    assert len(stored(page)['bank']['memories'])==2
    # A new local day: recall exact stored text and all four stages, no timer.
    data=stored(page); data['bank']['lastDailyDate']='2026-01-01'
    page.evaluate('([key,data])=>localStorage.setItem(key,JSON.stringify(data))',[KEY,data])
    page.goto(BASE+'#/',wait_until='networkidle'); page.reload(wait_until='networkidle')
    expect(page.locator('.remember-0')).to_be_visible()
    assert page.locator('blockquote').inner_text()=='“'+data['bank']['memories'][0]['happened']+'”'
    assert page.locator('.memory-fade').first.evaluate('(e)=>getComputedStyle(e).animationName')=='none'
    for stage in range(4):
        page.screenshot(path=str(OUT/f'remember-{stage}-mobile.png'),full_page=True)
        if stage==0: page.get_by_role('button',name='Tap to continue').click()
        elif stage==1: page.get_by_role('button',name='Tap when ready').click()
        elif stage==2:
            expect(page.locator('.feeling-words')).to_contain_text('Still unsure')
            page.get_by_role('button',name='Tap to continue').click()
    page.get_by_role('button',name='Start my day',exact=True).click()
    page.reload(wait_until='networkidle')
    expect(page.get_by_role('heading',name='Build Confidence',exact=True)).to_be_visible()
    # Practice selection starts a complete memory draft, and never invents evidence/feelings.
    page.get_by_role('button',name='Begin entry',exact=True).click()
    page.locator('#answer').fill('Worked through a difficult example.')
    page.get_by_label('Use this example for a bank memory after saving').check()
    page.get_by_role('button',name='Save and exit').click()
    page.get_by_role('button',name='Make my effort example a bank memory').click()
    page.get_by_label('Title',exact=True).fill('Worked through a difficult example')
    page.get_by_role('button',name='Continue',exact=True).click()
    expect(page.get_by_label('What happened',exact=True)).to_have_value('Worked through a difficult example.')
    page.once('dialog',lambda d:d.accept()); page.get_by_role('button',name='Exit',exact=True).click()
    expect(page.locator('.week>p')).to_have_text('1 practice day')
    # New bank memory is selectable before a challenge and survives deleting its source.
    page.get_by_role('button',name='II Prepare to Perform',exact=False).click()
    page.get_by_role('button',name='Continue',exact=True).click()
    page.get_by_role('button',name='Continue',exact=True).click()
    page.locator('.evidence-card').filter(has_text='Kept going after a hard question').click()
    page.get_by_role('button',name='Save and exit').click()
    assert 'Kept going' in stored(page)['preparations'][0]['confidenceSnapshot']
    page.get_by_role('button',name='View history',exact=True).click()
    prep=page.locator('article').filter(has_text='Prepare to Perform')
    prep.locator('.record-toggle').click()
    prep.get_by_role('button',name='Add event review').click()
    prep.get_by_label('What worked?',exact=True).fill('The first answer was clear.')
    prep.get_by_label('What will I practise next?',exact=True).fill('Pause before answering.')
    prep.get_by_role('button',name='Save review',exact=True).click()
    expect(prep).to_contain_text('The first answer was clear.')
    page.reload(wait_until='networkidle')
    assert stored(page)['preparations'][0]['review']['worked']=='The first answer was clear.'
    nav(page,'Weekly Review')
    page.get_by_label('What evidence of progress do I see?',exact=True).fill('Clearer answers.')
    page.get_by_role('button',name='Save weekly review',exact=True).click()
    assert len(stored(page)['weeklyReviews'])==1
    # Backup confirmation/cancellation, restoration, and malformed imports.
    nav(page,'Data & privacy')
    expect(page.get_by_text('Cloud storage is not connected to this deployment yet.',exact=False)).to_be_visible()
    with page.expect_download() as dl: page.get_by_role('button',name='Download .json').click()
    backup=OUT/'backup.json'; dl.value.save_as(backup)
    original=stored(page)
    bad={**original,'bank':{**original['bank'],'rotation':['unknown-memory']}}
    page.get_by_label('Import backup file').set_input_files({'name':'bad.json','mimeType':'application/json','buffer':json.dumps(bad).encode()})
    expect(page.get_by_text('Existing entries were not changed.',exact=False)).to_be_visible()
    assert stored(page)==original
    page.get_by_label('Import backup file').set_input_files(str(backup))
    page.get_by_role('button',name='Cancel',exact=True).click()
    assert stored(page)==original
    page.once('dialog',lambda d:d.accept()); page.get_by_role('button',name='Delete all',exact=True).click()
    assert stored(page)['practiceEntries']==[]
    page.get_by_label('Import backup file').set_input_files(str(backup))
    page.get_by_role('button',name='Replace and import').click()
    assert stored(page)==original
    # Capacity and full-bank route, then runtime override.
    full=json.loads(json.dumps(original))
    sample=full['bank']['memories'][0]
    full['bank']['memories']=[{**sample,'id':f'memory-{i}','title':f'Finished task {i}'} for i in range(10)]
    full['bank']['rotation']=[];full['bank']['lastDailyDate']='2026-01-01'
    page.get_by_label('Import backup file').set_input_files({'name':'full.json','mimeType':'application/json','buffer':json.dumps(full).encode()})
    page.get_by_role('button',name='Replace and import').click()
    page.goto(BASE+'#/',wait_until='networkidle');page.reload(wait_until='networkidle')
    expect(page.get_by_role('heading',name='Build Confidence',exact=True)).to_be_visible()
    assert page.get_by_role('button',name='Add a memory ›').count()==0
    assert page.locator('.bank-band .pillar-tier.filled').count()==10
    nav(page,'Data & privacy')
    page.get_by_label('Keep daily recall when my bank has ten memories').check()
    full=stored(page);full['bank']['lastDailyDate']='2026-01-01'
    page.evaluate('([key,data])=>localStorage.setItem(key,JSON.stringify(data))',[KEY,full])
    page.goto(BASE+'#/',wait_until='networkidle');page.reload(wait_until='networkidle')
    expect(page.locator('.remember-0')).to_be_visible()
    page.get_by_role('button',name='Tap to continue').click(); page.get_by_role('button',name='Tap when ready').click(); page.get_by_role('button',name='Tap to continue').click()
    assert page.get_by_role('button',name='Fill the bank').count()==0
    page.get_by_role('button',name='Start my day').click()
    # Desktop, narrow mobile, theme, real italic font, no overflow.
    for width in [320,390,1440]:
        page.set_viewport_size({'width':width,'height':900})
        assert page.evaluate('document.documentElement.scrollWidth<=window.innerWidth'),f'overflow at {width}'
        page.screenshot(path=str(OUT/f'home-{width}-light.png'),full_page=True)
    nav(page,'Home');page.get_by_role('button',name='Switch to dark mode').click()
    page.screenshot(path=str(OUT/'home-desktop-dark.png'),full_page=True)
    assert page.evaluate("document.fonts.check('italic 20px \"EB Garamond\"')")
    assert not external,external
    assert not failures,failures
    assert not errors,errors
    browser.close()
print('Browser checks passed: capture, milestones, editing/deletion, recall/day rules, practice/preparation integration, backups, invalid imports, capacity, themes, responsive layouts, reduced motion, no external requests.')

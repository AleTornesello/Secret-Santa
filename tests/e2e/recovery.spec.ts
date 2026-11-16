import { type Browser, type BrowserContext, devices } from '@playwright/test';
import { test, expect } from './fixtures.js';
const contexts:BrowserContext[]=[];
test.afterEach(async()=>{await Promise.all(contexts.splice(0).map(c=>c.close()));});
async function exchange(browser:Browser,url:string,draw=true,mobile=false,names=['Alice','Bob']){
 const options=mobile?devices['Pixel 7']:{};
 const creator=await browser.newContext(options);const guest=await browser.newContext(options);contexts.push(creator,guest);
 const alice=await creator.newPage();const bob=await guest.newPage();
 await alice.clock.install();await bob.clock.install();
 await alice.goto(url);await alice.getByLabel('Who’s joining?').fill(names.join('\n'));await alice.getByRole('button',{name:'Create your group'}).click();
 await alice.waitForURL('**/groups/*');const link=alice.url();const code=new URL(link).pathname.split('/').pop()!;
 await alice.getByRole('button',{name:"I'm "+names[0],exact:true}).click();
 await bob.goto(link);await bob.getByRole('button',{name:"I'm "+names[1],exact:true}).click();
 await expect(alice.getByRole('button',{name:'Reveal the names'})).toBeEnabled();
 if(draw){await alice.getByRole('button',{name:'Reveal the names'}).click();await expect(bob.getByTestId('recipient')).toBeVisible();}
 return{alice,bob,creator,guest,link,code};
}
async function session(context:BrowserContext){return(await context.cookies()).find(c=>c.name==='ss_session')!.value;}
test('offline_then_reconnect_preserves_recipient',async({browser,baseURL,platform},info)=>{
 const g=await exchange(browser,baseURL!,true,info.project.name==='mobile');const before=await g.bob.getByTestId('recipient').textContent();
 await g.guest.setOffline(true);await g.guest.setOffline(false);await g.bob.reload();await expect(g.bob.getByTestId('recipient')).toHaveText(before!);
 expect(platform.groups.get(g.code,await session(g.guest)).recipient?.name).toBe(before);
});
test('result_stays_hidden_until_session_revalidates_after_page_resume',async({browser,baseURL},info)=>{
 const g=await exchange(browser,baseURL!,true,info.project.name==='mobile');const before=await g.bob.getByTestId('recipient').textContent();
 await g.bob.evaluate(()=>window.dispatchEvent(new Event('pagehide')));await expect(g.bob.getByTestId('recipient')).toBeHidden();
 await g.bob.evaluate(()=>window.dispatchEvent(new Event('pageshow')));await expect(g.bob.getByTestId('recipient')).toHaveText(before!);
});
test('two_tabs_do_not_duplicate_identity_or_presence',async({browser,baseURL,platform},info)=>{
 const g=await exchange(browser,baseURL!,false,info.project.name==='mobile');const tab=await g.guest.newPage();await tab.goto(g.link);
 await expect(tab.locator('#live-status')).toHaveText(/Everyone is here/);const guestId=await session(g.guest);
 await g.bob.close();expect(platform.groups.get(g.code,guestId).participants[1].connected).toBe(true);
 await tab.close();await expect.poll(()=>platform.groups.get(g.code,guestId).participants[1].connected).toBe(false);
});
test('creator_release_updates_all_old_tabs',async({browser,baseURL,platform},info)=>{
 const g=await exchange(browser,baseURL!,false,info.project.name==='mobile');const tab=await g.guest.newPage();await tab.goto(g.link);await expect(tab.locator('#live-status')).toHaveText(/Everyone is here/);
 const bobRow=g.alice.locator('.roster li').filter({has:g.alice.getByText('Bob',{exact:true})});await bobRow.getByRole('button',{name:'Release name'}).click();
 for(const page of [g.bob,tab])await expect(page.locator('#identity-hint')).toHaveText('Select your own name to join the exchange.');
 expect(platform.groups.get(g.code,await session(g.guest)).selfId).toBeNull();
});
test('expiry_before_draw_blocks_every_action',async({browser,baseURL,platform,advanceServerTime},info)=>{
 const g=await exchange(browser,baseURL!,false,info.project.name==='mobile');const creatorId=await session(g.creator);
 advanceServerTime(3_600_000);await expect(g.alice.getByRole('heading',{name:'This group has expired'})).toBeVisible();
 expect(()=>platform.groups.draw(g.code,creatorId)).toThrow(expect.objectContaining({code:'GROUP_UNAVAILABLE'}));
 expect((await g.creator.request.get(g.link)).status()).toBe(404);
});
test('expiry_after_draw_clears_connected_and_offline_results',async({browser,baseURL,advanceServerTime},info)=>{
 const g=await exchange(browser,baseURL!,true,info.project.name==='mobile');await g.guest.setOffline(true);
 advanceServerTime(3_600_000);await expect(g.alice.getByTestId('recipient')).toBeHidden();
 await g.bob.clock.fastForward(3_601_000);await expect(g.bob.getByTestId('recipient')).toBeHidden();
 await g.guest.setOffline(false);await g.bob.evaluate(()=>window.dispatchEvent(new Event('pageshow')));
 await expect(g.bob.getByTestId('recipient')).toBeHidden();expect(await g.bob.getByTestId('recipient').textContent()).toBe('');
});
test('browser_history_cannot_restore_an_expired_recipient',async({browser,baseURL,advanceServerTime},info)=>{
 const g=await exchange(browser,baseURL!,true,info.project.name==='mobile');await g.alice.goto(baseURL!);advanceServerTime(3_600_000);await g.alice.goBack();
 await expect(g.alice.getByTestId('recipient')).toBeHidden();await expect(g.alice.locator('main')).toContainText(/unavailable|expired/);
});
test('lost_cookie_cannot_reclaim_a_drawn_identity',async({browser,baseURL},info)=>{
 const g=await exchange(browser,baseURL!,true,info.project.name==='mobile');await g.guest.clearCookies();await g.bob.reload();
 await expect(g.bob.getByTestId('recipient')).toBeHidden();await expect(g.bob.locator('#identity-hint')).toHaveText('This exchange has already been drawn.');
 await expect(g.bob.getByRole('button',{name:"I'm Alice",exact:true})).toHaveCount(0);
});
test('names_remain_text_in_the_live_roster',async({browser,baseURL},info)=>{
 const name='<img src=x onerror="window.exploited=true">';
 const g=await exchange(browser,baseURL!,false,info.project.name==='mobile',[name,'Bob']);
 await expect(g.bob.locator('.roster strong').first()).toHaveText(name);
 await expect(g.bob.locator('.roster img')).toHaveCount(0);expect(await g.bob.evaluate(()=>Reflect.get(window,'exploited'))).toBeUndefined();
});
test('maximum_length_names_fit_a_narrow_phone',async({browser,baseURL})=>{
 const context=await browser.newContext({viewport:{width:320,height:800}});contexts.push(context);const page=await context.newPage();
 await page.goto(baseURL!);await page.getByLabel('Who’s joining?').fill('A'.repeat(80)+'\n'+'B'.repeat(80));await page.getByRole('button',{name:'Create your group'}).click();
 await expect(page.getByRole('button',{name:"I'm "+'A'.repeat(80),exact:true})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
});


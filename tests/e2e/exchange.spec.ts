import { test, expect } from './fixtures.js';
test('three_independent_browsers_complete_one_exchange',async({browser,baseURL,viewport,isMobile,hasTouch,userAgent,deviceScaleFactor})=>{
 const contexts=await Promise.all([0,1,2].map(()=>browser.newContext({viewport,isMobile,hasTouch,userAgent,deviceScaleFactor})));
 try{
 const pages=await Promise.all(contexts.map(c=>c.newPage()));const [alice,bob,carol]=pages;
 await alice.goto(baseURL!);await alice.getByLabel('Who’s joining?').fill('Alice\nBob\nCarol');await alice.getByRole('button',{name:'Create your group'}).click();
 await alice.waitForURL('**/groups/*');const link=alice.url();
 await alice.getByRole('button',{name:"I'm Alice",exact:true}).click();
 await bob.goto(link);await bob.getByRole('button',{name:"I'm Bob",exact:true}).click();
 await carol.goto(link);await carol.getByRole('button',{name:"I'm Carol",exact:true}).click();
 await expect(alice.getByRole('button',{name:'Reveal the names'})).toBeEnabled();
 await alice.getByRole('button',{name:'Reveal the names'}).click();
 const results:string[]=[];for(const [i,page]of pages.entries()){await expect(page.getByTestId('recipient')).toBeVisible();const name=(await page.getByTestId('recipient').textContent())!;expect(name).not.toBe(['Alice','Bob','Carol'][i]);results.push(name);}
 expect(new Set(results).size).toBe(3);
 await bob.reload();await expect(bob.getByTestId('recipient')).toHaveText(results[1]);
 for(const page of pages)expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
 }finally{await Promise.all(contexts.map(c=>c.close()));}
});


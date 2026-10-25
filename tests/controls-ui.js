// Open the local page, then run: playwright-cli run-code --filename tests/controls-ui.js
async (page) => {
  const fixture = "AwUGBAo_AAAAAAAAAP8FAQEAAQMABQMEBAIEBQMEAgIEAgIBBAMCAgACAwQAAAAAqA";
  const errors = [];
  page.on("pageerror", error => errors.push(String(error)));
  await page.addInitScript(() => {
    window.__clock = 1000;
    performance.now = () => window.__clock;
    window.requestAnimationFrame = callback => { window.__nextFrame = callback; return 1; };
    window.__stepFrame = time => { window.__clock = time; const callback = window.__nextFrame; window.__nextFrame = null; callback(time); };
  });
  const check = (ok, message) => { if (!ok) throw new Error(message); };
  const setup = async (code = fixture, prefs = {}) => {
    await page.evaluate(({code,prefs}) => {
      localStorage.setItem("pt.prefs", JSON.stringify(Object.assign({lang:"en",timeInf:true,statMode:false,useSkins:false},prefs)));
      history.replaceState(null,"",location.pathname + "?debug#" + code);
    }, {code,prefs});
    await page.reload();
    await page.evaluate(() => __stepFrame(1000));
    await page.locator("#board").scrollIntoViewIfNeeded();
    const box = await page.locator("#board").boundingBox();
    return {x:box.x,y:box.y,cell:box.width/6};
  };
  const move = async (box, x, y, time) => {
    if (time != null) await page.evaluate(time => { __clock = time; },time);
    await page.mouse.move(box.x + box.cell*x,box.y + box.cell*y);
  };
  const cellImage = time => page.evaluate(time => {
    __stepFrame(time);
    const source=document.getElementById("board"), cell=source.width/6;
    const crop=document.createElement("canvas"); crop.width=crop.height=cell;
    crop.getContext("2d").drawImage(source,cell,cell,cell,cell,0,0,cell,cell);
    return crop.toDataURL();
  },time);

  for (const [end,expected] of [[[2.5,1.5],[0,1,7,8]],[[1.5,1.2],[0,1,7]],[[1.5,1.5],[0,7]]]) {
    const box=await setup();
    await move(box,0.5,0.5); await page.mouse.down(); await move(box,...end,1010);
    const route=await page.evaluate(() => __S.move.path);
    await page.mouse.up();
    check(JSON.stringify(route)===JSON.stringify(expected),"Wrong pointer route: " + JSON.stringify(route));
  }

  for (const blocker of ["stone","tape"]) {
    const code=await page.evaluate(({fixture,blocker}) => {
      const board=Engine.decode(fixture);
      if(blocker==="stone") board.orbs[1]=Engine.STONE;
      else board.flags[1]=Engine.F_TAPE;
      return Engine.encode(board);
    },{fixture,blocker});
    const box=await setup(code);
    await move(box,0.5,0.5); await page.mouse.down(); await move(box,2.5,1.5,1010);
    const route=await page.evaluate(() => __S.move.path);
    await page.mouse.up();
    check(JSON.stringify(route)==="[0]","Swipe bypassed " + blocker);
  }

  await setup();
  const curve=await page.evaluate(() => {
    const board=document.getElementById("board"), box=board.getBoundingClientRect(), cell=box.width/6;
    const event=(type,x,y)=>new PointerEvent(type,{clientX:box.x+x*cell,clientY:box.y+y*cell,pointerId:1,bubbles:true});
    board.dispatchEvent(event("pointerdown",0.5,0.5)); __clock=1010;
    const pointer=event("pointermove",1.2,0.8);
    pointer.getCoalescedEvents=()=>[event("pointermove",1.5,0.5),event("pointermove",1.5,1.5)];
    board.dispatchEvent(pointer);
    const route=__S.move.path.slice();
    board.dispatchEvent(event("pointerup",1.5,1.5));
    return route;
  });
  check(JSON.stringify(curve)==="[0,1,7]","Coalesced curve lost an intermediate position");

  let box=await setup(fixture,{timeInf:false,timeLimit:0.5});
  await move(box,0.5,0.5); await page.mouse.down(); await move(box,1.5,0.5,1010);
  const expired=await page.evaluate(() => {
    __clock=1511;
    const board=document.getElementById("board"), box=board.getBoundingClientRect(), cell=box.width/6;
    board.dispatchEvent(new PointerEvent("pointerup",{clientX:box.x+cell*2.5,clientY:box.y+cell*0.5,pointerId:1,bubbles:true}));
    return {route:__S.res.path,time:__S.res.time,timeout:__S.res.timeout};
  });
  await page.mouse.up();
  check(JSON.stringify(expired.route)==="[0,1]" && expired.time===0.5 && expired.timeout,"Release added a swap after the deadline");

  box=await setup();
  await move(box,1.5,1.5); await page.mouse.down(); await move(box,2.5,1.5,1010);
  const frames=[];
  for(const time of [1010,1055,1100,1190]) frames.push(await cellImage(time));
  await page.mouse.up();
  check(frames[0]!==frames[1] && frames[1]!==frames[2],"Pushed orb teleports instead of sliding");
  check(frames[2]===frames[3],"Swap animation does not settle after 90ms");
  check(await page.evaluate(() => Math.abs(__S.res.time-0.18)<0.001),"Animation changed the measured move time");
  await page.evaluate(() => __stepFrame(5000));
  const result=await page.evaluate(() => ({combos:__S.res.sim.combos,time:__S.res.time}));
  await page.locator("#btnReplay").click();
  const replay=[];
  for(const time of [5010,5055,5100]) replay.push(await cellImage(time));
  check(replay[0]!==replay[1] && replay[1]!==replay[2],"Replay does not animate the pushed orb");
  await page.evaluate(() => { __stepFrame(5190); __stepFrame(7000); });
  check(await page.evaluate(result => __S.phase==="done" && __S.res.sim.combos===result.combos && __S.res.time===result.time,result),"Replay changed the result");

  box=await setup();
  const original=await page.evaluate(() => __S.bd.orbs.slice());
  await move(box,1.5,1.5); await page.mouse.down(); await move(box,2.5,1.5,1010);
  await page.evaluate(() => __stepFrame(1040));
  await move(box,1.5,1.5,1040);
  await page.evaluate(() => __stepFrame(1130));
  await page.mouse.up();
  check(await page.evaluate(original => JSON.stringify(__S.res.after)===JSON.stringify(original) && __S.res.steps===2,original),"A quick reversal changed the orb order");
  check(!errors.length,errors.join("\n"));
  return {routes:"straight, shallow and diagonal",blockers:"stone and tape",coalesced:"curve preserved",deadline:"no late swaps",animation:"90ms and replay",reversal:"original order restored",pageErrors:errors};
}

/**
 * Things simulated players say. English source strings (translated when shown);
 * pure emotes are kept as-is. A conversation is an opener and a matching reply.
 */
export const EMOTES = [':)', ':D', '<3', 'o/', 'xD', ':(', '>:(', 'lol', ':P', '^_^'];

export const CHAT: Record<string, string[]> = {
  greet: ['hi!', 'hey o/', 'yo', 'hello there', 'sup'],
  greetReply: ['hi :)', 'o/', 'hey!', 'heyo', 'hello!'],
  ask: ['anyone wanna group?', 'where do I find wolves?', 'lf healer', 'how do I get gold fast?', 'is the boss up?', 'what level are you?'],
  askReply: ['sure, inv me', 'check the forest', 'no idea lol', 'farm slimes', 'just died to it xD', 'same lvl as you'],
  trade: ['WTS slime gel, cheap!', 'WTB iron sword', 'selling wolf pelts, pm me', 'anyone buying loot?'],
  tradeReply: ['how much?', 'too expensive', 'deal!', 'check the auction'],
  joke: ['this game is so addictive', 'one more quest then sleep', 'my mom is calling me lol', 'who needs sleep anyway'],
  jokeReply: ['xD', 'same', 'lol', 'relatable'],
  levelUp: ['Ding! {n}!', 'LEVEL {n}!!', 'finally lvl {n}'],
  levelUpReply: ['grats!', 'gz', 'nice!', 'congrats o/'],
  death: ['lag!!', 'noooo', 'healer??', 'that was unfair', 'brb respawning'],
  pvpWin: ['ez', 'gg no re', 'git gud', 'sit down'],
  raidPull: ['CHARGE!', 'go go go!', 'pulling!', 'focus the boss!'],
  raidWin: ['GG!!!', 'WE DID IT', 'finally!!', 'loot time :D'],
  wipe: ['who pulled?!', 'healer pls...', 'one more try', 'wipe again lol'],
  sold: ['sold! :D', 'ka-ching', 'auction money!'],
  quest: ['quest done o/', 'easy quest', 'that took forever'],
  clan: ['hi guild o/', 'raid tonight?', 'love this clan <3'],
  patch: ['new patch!!', 'read the patch notes?', 'they nerfed my class >:('],
  groupAsk: ['LFG! who wants to hunt?', 'group up, anyone?', 'need 2 more, come!'],
  groupYes: ['sure, inv me', 'coming!', 'I\'m in o/', 'wait for me'],
  trained: ['new skills, yay!', 'trainer taught me a new move', 'time to test my new skill'],
  caught: ['caught a fish!', 'nice catch :D', 'fish for dinner'],
  afk: ['brb', 'afk 5 min', 'brb food'],
  campfire: ['cozy fire', 'warming up :)', 'nice spot'],
  dance: ['\\o/', 'dance party!', '*dances*'],
  sightsee: ['what a view', 'nice place', 'screenshot time'],
  help: ['hang on!', 'I got you!', 'heal incoming'],
  bug: ['stuck in a wall lol', 'is this a bug?', 'fell through the map xD'],
};

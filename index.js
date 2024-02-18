const puppeteer = require('puppeteer');
const baseUrl = "https://www.ffhandball.fr/competitions/";
const mongoose = require('mongoose');
const dbUrl = 'mongodb+srv://ascrhb:HPEMFCDLUxcISHEY@db.psmtqt8.mongodb.net/'
const debug = true;

// TODO: input data array of each teams

//main 
(async () => {
  const db = initDbConnection(dbUrl);

  // TODO: Iterate on each teams 
  // begin
  let season = 'saison-2023-2024-19';
  let championship = '16-ans-prenationale-masculine-bretagne-22352';
  let groupe= 'poule-127203';
  let team= 'equipe-1586490';

  const leaderboard = await getLeaderboard(season, championship, groupe);
  // TODO: Nullable return handling

  // TODO: put results in DB

  const playersStats = await getPlayersStats(season, championship, team);
  // TODO: Nullable return handling

  const goalKeepersStats = await getGoalKeepersStats(season, championship, team);
  // TODO: Nullable return handling

  // TODO: put results in DB
  //end
  console.log("My job is done.")
  db.close();
})();

/**
 * Get leaderboard data and format into an object
 * @param {string} season 
 * @param {string} championship 
 * @param {string} groupe 
 * @returns {object|null}
 */
async function getLeaderboard(season, championship, groupe) {
  const browser = await puppeteer.launch({
    headless: !debug,
  });
  const page = await browser.newPage();
  
  // Your Puppeteer script goes here
  await page.goto(baseUrl + '/' + season + '/regional/' + championship + '/' + groupe + '/classements/');
  
  await rejectCoockies(page);

  const table_class = '.style_classement__VzowG';
  const leaderboard = await page.$(table_class);

  // LeaderBoard parsing
  if (leaderboard) {
    console.log("Leaderboard exist, parse it..."); 
    const headsArray = [];
    const cellsArray = [];

    // Table parsing
    const rows = await leaderboard.$$('tr');
    for (const rowElement of rows) {
      // Thead parsing
      const headCells = await rowElement.$$('th');
      for (const headCellElement of headCells) {
        const headCellContent = await page.evaluate(element => element.textContent, headCellElement)
        headsArray.push(headCellContent);
      }

      // Tbody parsing
      const cells = await rowElement.$$('td');
      for (const cellElement of cells) {
        const cellContent = await page.evaluate(element => element.textContent, cellElement);
        cellsArray.push(cellContent);
      }
    }
    await browser.close();
    return headsAndCellsObjectConstruct(headsArray, cellsArray);
  }
  console.log("No leaderboard");
  await browser.close();
  return null;
}

/**
 * Same as getPlayersStats but it get goalkeepers stats
 * @param {string} season 
 * @param {string} championship 
 * @param {string} team 
 * @returns 
 */
async function getGoalKeepersStats(season, championship, team) {
  return await getPlayersStats(season, championship, team, true);
}

/**
 * Get players statistics and format data into an object
 * @param {string} season 
 * @param {string} championship 
 * @param {string} team 
 * @param {bool} goalkeepers
 * @returns {object}
 */
async function getPlayersStats(season, championship, team, goalkeepers = false) {
  const browser = await puppeteer.launch({
    headless: !debug,
  });
  const page = await browser.newPage();
  
  // Your Puppeteer script goes here
  await page.goto(baseUrl + '/' + season + '/regional/' + championship + '/' + team + '/statistiques/');
  
  await rejectCoockies(page);

  if (goalkeepers) {
    console.log("Goalkeepers Parsing!");
    const playersTypeBtn = await page.$$('.styles_button__LdmfN');
    const goalkeepersBtn = await playersTypeBtn[1];
    goalkeepersBtn.click();
  }

  // Headers parsing
  const headers = await page.$('.styles_header__Y92xl');
  if (headers) {
    const headsArray = [];
    const cellsArray = [];
    // Maybe make a data cleaner ?
    const unwantedClass = [
      'styles_toggle__D7pZQ', 
      'styles_club__Krzom', 
      'styles_icon__n2b21', 
      'styles_vertical__F05AF', 
      'styles_horizontal__iyDAK',
      'styles_club__oGTOg',
      'styles_toggle__GbMsD'
    ];

    // Check if there is more than one page of player
    let navigationBtn = await page.$$('.styles_iconButton__C35f5');
    let nextPageBtnDisabled;
    if (navigationBtn>0) {
      let nextPageBtn = await navigationBtn[2];
      nextPageBtnDisabled = await page.evaluate(element => element.disabled, nextPageBtn);
    } else {
      nextPageBtnDisabled = true;
    }

    console.log("Headers exist, parse it!");
    const headersRows = await headers.$$('div');
    for (const headerElement of headersRows) {
      const headClass = await page.evaluate(element => element.className, headerElement);

      if (!unwantedClass.includes(headClass)) {
        let headerContent = await page.evaluate(element => element.textContent, headerElement);
        headsArray.push(headerContent);
      }
    }

    // Handling multiple results pages parsing
    do {
      if (navigationBtn>0)  {
        navigationBtn = await page.$$('.styles_iconButton__C35f5');
        nextPageBtn = await navigationBtn[2];
        nextPageBtnDisabled = await page.evaluate(element => element.disabled, nextPageBtn);
      }
      const rows = await page.$$('.styles_row__29ajo');
      if (rows) {
        console.log("There is rows, parsing them!");

        for (const rowElement of rows) {
          let cells = await rowElement.$$('div');
          for (const cellElement of cells) {
            const cellClass = await page.evaluate(element => element.className, cellElement);

            if (!unwantedClass.includes(cellClass)) {
              const cellContent = await page.evaluate(element => element.textContent, cellElement);
              cellsArray.push(cellContent);
            }
          }
        }
      }

      if (navigationBtn>0) {
        console.log("NEXT PAGE !");
        await nextPageBtn.click();
        console.log("PAGE OK");
      }
    } while (!nextPageBtnDisabled);
    // TODO: details => styles_details__bhl4i ; later 
    await browser.close();
    return headsAndCellsObjectConstruct(headsArray, cellsArray);
  }

  console.log("No players stats.");
  await browser.close();
  return null;
}

//--- UTILS ---//

/**
 * Format data from two array into an usable object 
 * @param {array} heads 
 * @param {array} cells
 * @return {object}
 */
function headsAndCellsObjectConstruct(heads, cells) {
  console.log("Formating data...");
  // we need to slice the cells array in chunck of the heads array size
  const chunkedCells = [];
  for (let i = 0; i < cells.length; i += heads.length) {
    chunkedCells.push(cells.slice(i, i + heads.length));
  }

  // object construction key => values for each chunk
  const headsAndCells = {};
  let j = 0;
  for (const chunk of chunkedCells) {
    const result = {};
    for (let i = 0; i < Math.min(heads.length, chunk.length); i++) {
      result[heads[i]] = chunk[i];
    }
    headsAndCells[j] = result;
    j++;
  }
  console.log("Data formated!");
  return headsAndCells;
}

/**
 * Reject cookies
 * @param {page} page 
 */
async function rejectCoockies(page) {
  const continue_wo_agree = '.didomi-continue-without-agreeing';
  const cookie_btn = await page.$(continue_wo_agree);
  
  if (cookie_btn) {
    console.log("Cookie btn exist, click on it");
    await page.click(continue_wo_agree);
  }
  return;
}

/**
 * Init db connection with mongoose & listen for events
 * @param {string} dbUrl 
 * @returns {Mongoose.connection} 
 */
function initDbConnection(dbUrl) {
  console.log("Trying to connect to database...")
  // Connect to MongoDB using mongoose
  mongoose.connect(dbUrl);

  // Get the default connection
  const db = mongoose.connection;

  // Event listener for successful connection
  db.on('connected', () => {
    console.log('Connected to MongoDB');
  });

  // Event listener for connection errors
  db.on('error', (err) => {
    console.error('Error connecting to MongoDB:', err);
  });

  // Event listener for disconnection
  db.on('disconnected', () => {
    console.log('Disconnected from MongoDB');
  });

  return db;
}
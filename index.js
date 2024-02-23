const puppeteer = require("puppeteer");
const baseUrl = "https://www.ffhandball.fr/competitions";
const mongoose = require("mongoose");
const config = require("./config.json");
const teams = require("./teams.json");
const Leaderboard = require("./models/leaderboard.js")
const headless = true;

//main
(async () => {
  console.log("Starting");
  const season = teams.utils.season;
  const db = await initDbConnection(config.mongoURI);

  for (const team of teams.ascr) {
    console.log("Scrapping team: " + team.name);
    const leaderboard = await getLeaderboard(
      season,
      team.championship,
      team.groupeID
    );
    // Nullable return handling
    if (!leaderboard) {
      console.log("No datas.");
    } else {
      // >Put results in DB
      let cleanLeaderboardData = await cleanLeaderboard(leaderboard);
      // Prepare leaderboard for db saving
      let leaderboardForDb = {
        team_name: team.name,
        leaderboard: cleanLeaderboardData,
      };
      await saveLeaderboard(leaderboardForDb);
    }

    const playersStats = await getPlayersStats(
      season,
      team.championship,
      team.teamID
    );
    // Nullable return handling
    if (!playersStats) {
      console.log("No datas.");
    } else {
      // TODO: put results in DB
      await savePlayersStats(playersStats);
    }

    const goalkeepersStats = await getGoalkeepersStats(
      season,
      team.championship,
      team.teamID
    );
    // Nullable return handling
    if (!goalkeepersStats) {
      console.log("No datas.");
    } else {
      // TODO: put results in DB
      await saveGoalkeepersStats(goalkeepersStats);
    }
  }
  console.log("My job is done.");
  db.close();
})();

//--- SCRAPPING ---//

/**
 * Get leaderboard data and format into an object
 * @param {string} season
 * @param {string} championship
 * @param {string} groupe
 * @returns {object|null}
 */
async function getLeaderboard(season, championship, groupe) {
  const browser = await puppeteer.launch({
    headless: headless,
  });
  const page = await browser.newPage();

  // Your Puppeteer script goes here
  await page.goto(
    baseUrl +
      "/" +
      season +
      "/regional/" +
      championship +
      "/" +
      groupe +
      "/classements/"
  );

  await rejectCoockies(page);

  const table_class = ".style_classement__VzowG";
  const leaderboard = await page.$(table_class);

  // LeaderBoard parsing
  if (leaderboard) {
    console.log("Leaderboard exist, parse it...");
    const headsArray = [];
    const cellsArray = [];

    // Table parsing
    const rows = await leaderboard.$$("tr");
    for (const rowElement of rows) {
      // Thead parsing
      const headCells = await rowElement.$$("th");
      for (const headCellElement of headCells) {
        const headCellContent = await page.evaluate(
          (element) => element.textContent,
          headCellElement
        );
        headsArray.push(headCellContent);
      }

      // Tbody parsing
      const cells = await rowElement.$$("td");
      for (const cellElement of cells) {
        const cellContent = await page.evaluate(
          (element) => element.textContent,
          cellElement
        );
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
async function getGoalkeepersStats(season, championship, team) {
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
async function getPlayersStats(
  season,
  championship,
  team,
  goalkeepers = false
) {
  const browser = await puppeteer.launch({
    headless: headless,
  });
  const page = await browser.newPage();

  // Your Puppeteer script goes here
  await page.goto(
    baseUrl +
      "/" +
      season +
      "/regional/" +
      championship +
      "/" +
      team +
      "/statistiques/"
  );

  await rejectCoockies(page);

  if (goalkeepers) {
    console.log("Goalkeepers Parsing...");
    const playersTypeBtn = await page.$$(".styles_button__LdmfN");
    const goalkeepersBtn = await playersTypeBtn[1];

    // Handle no goalkeepers section
    if (!goalkeepersBtn) {
      console.log("No goalkeepers stats.");
      await browser.close();
      return null;
    }
    console.log("Goalkeepers section existe, parsing it!");
    goalkeepersBtn.click();
  } else {
    console.log("Players Parsing...");
  }

  // Headers parsing
  const headers = await page.$(".styles_header__Y92xl");
  if (headers) {
    const headsArray = [];
    const cellsArray = [];
    // Maybe make a data cleaner ?
    const unwantedClass = [
      "styles_toggle__D7pZQ",
      "styles_club__Krzom",
      "styles_icon__n2b21",
      "styles_vertical__F05AF",
      "styles_horizontal__iyDAK",
      "styles_club__oGTOg",
      "styles_toggle__GbMsD",
    ];

    // Check if there is more than one page of player
    let navigationBtn = await page.$$(".styles_iconButton__C35f5");
    let nextPageBtnDisabled;
    if (navigationBtn.length > 2) {
      console.log("Check if there is more than one page of player ...");
      let nextPageBtn = await navigationBtn[2];
      nextPageBtnDisabled = await page.evaluate(
        (element) => element.disabled,
        nextPageBtn
      );
    } else {
      nextPageBtnDisabled = true;
    }

    console.log("Headers exist, parse it!");
    const headersRows = await headers.$$("div");
    for (const headerElement of headersRows) {
      const headClass = await page.evaluate(
        (element) => element.className,
        headerElement
      );

      if (!unwantedClass.includes(headClass)) {
        let headerContent = await page.evaluate(
          (element) => element.textContent,
          headerElement
        );
        headsArray.push(headerContent);
      }
    }

    // Handling multiple results pages parsing
    do {
      if (navigationBtn.length > 2 && !nextPageBtnDisabled) {
        navigationBtn = await page.$$(".styles_iconButton__C35f5");
        nextPageBtn = await navigationBtn[2];
        if (nextPageBtn) {
          nextPageBtnDisabled = await page.evaluate(
            (element) => element.disabled,
            nextPageBtn
          );
        } else {
          nextPageBtnDisabled = true;
        }
      } else {
        nextPageBtnDisabled = true;
      }

      const rows = await page.$$(".styles_row__29ajo");
      if (rows) {
        console.log("There is rows, parsing them!");

        for (const rowElement of rows) {
          let cells = await rowElement.$$("div");
          for (const cellElement of cells) {
            const cellClass = await page.evaluate(
              (element) => element.className,
              cellElement
            );

            if (!unwantedClass.includes(cellClass)) {
              const cellContent = await page.evaluate(
                (element) => element.textContent,
                cellElement
              );
              cellsArray.push(cellContent);
            }
          }
        }
      }

      if (navigationBtn.length > 2 && !nextPageBtnDisabled) {
        console.log("Next page ...");
        await nextPageBtn.click();
        console.log("Page ready");
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

//--- DATA RECORDS ---//

/**
 * Init db connection with mongoose & listen for events
 * @param {string} dbUrl
 * @returns {Promise<mongoose.connection>}
 */
async function initDbConnection(dbUrl) {
  console.log("Trying to connect to database...");
  // Connect to MongoDB using mongoose
  await mongoose.connect(dbUrl);

  // Get the default connection
  const db = mongoose.connection;

  // Event listener for successful connection
  db.on("connected", () => {
    console.log("Connected to MongoDB");
  });

  // Event listener for connection errors
  db.on("error", (err) => {
    console.error("Error connecting to MongoDB:", err);
  });

  // Event listener for disconnection
  db.on("disconnected", () => {
    console.log("Disconnected from MongoDB");
  });

  return db;
}

/**
 * Save leaderboard in db
 * @param {object} leaderboard 
 */
async function saveLeaderboard(leaderboard) {
  console.log("Saving leaderboard...");
  const newLeaderboard = new Leaderboard(leaderboard);

  try {
    const savedLeaderboard = await newLeaderboard.save();
    console.log('Blog saved:', savedLeaderboard);
  } catch (error) {
    console.error(error);
  }
}

// TODO: HERE !
async function savePlayersStats(playersStats) {
  //For each players
    // Check if player exist in player table by names
      // Yes : Add in playerStats table
      // No : Create player and Add in playerStats table
}

async function saveGoalkeepersStats(goalkeepersStats) {
  //For each goalkeepers
    // Check if goalkeepers exist in player table by names
      // Yes : Add in playerStats table
      // No : Create player and Add in playerStats table
}

async function createPlayer(player) {
  // Check if player exist in player table by names
    // No : create player
    // Yes : Error
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
  console.log("Rejecting cookies ...");
  const continue_wo_agree = ".didomi-continue-without-agreeing";
  const cookie_btn = await page.$(continue_wo_agree);

  if (cookie_btn) {
    console.log("Cookie btn exist, click on it");
    await page.click(continue_wo_agree);
  }
  return;
}

/**
 * Clean leaderboard data for db save
 * @param {object} leaderboard
 * @returns {object}
 */
async function cleanLeaderboard(leaderboard) {
  console.log("Cleaning leaderboard datas...");
  const cleanLeaderboard = {};

  for (const key in leaderboard) {
    let team = leaderboard[key];
    cleanLeaderboard[key] = await cleanTeamData(team);
  }

  console.log("Leaderboard datas cleaning Ok!");
  return cleanLeaderboard;
}

/**
 * Clean team datas, change fields names and filters some fields
 * @param {object} team
 * @returns {object}
 */
async function cleanTeamData(team) {
  console.log("Cleanning team : " + team.Club + " datas...");
  const feildsNames = {
    "N°": "position",
    Club: "team_name",
    Pts: "points",
    "J.": "played_games",
    "G.": "won_games",
    "N.": "draw_games",
    "P.": "loos_games",
    "B +": "scored_goals",
    "B -": "conceded_goals",
    "D.": "goal_difference",
  };

  const cleanTeamData = {};
  for (const key in team) {
    if (feildsNames[key]) {
      cleanTeamData[feildsNames[key]] = team[key];
    }
  }

  console.log("Team datas cleaning Ok!");
  return cleanTeamData;
}

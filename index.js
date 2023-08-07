const axios = require("axios");
const cheerio = require("cheerio");
const path = require("path");
const envData = require("dotenv").config({
  path: path.resolve(__dirname, ".env"),
});

// 移除非法字符和特殊字符
const cleanDate = (input) => {
  const cleanedInput = input.replace(/[;<>'"\/\\]/g, "");
  return cleanedInput;
};

const getMatchSchedule = async (year) => {
  const baseUrl = "https://www.ctfa.com.tw";
  const mainUrl = `https://www.ctfa.com.tw/tfpl${year}`;

  const mainUrlData = await axios.get(mainUrl);
  if (mainUrlData.status !== 200) {
    console.log("Request Error");
    return [];
  }

  let roundUrl = {
    "01": "",
    "02": "",
    "03": "",
  };

  const mainContent = cheerio.load(mainUrlData.data);
  const round = "span.pageNav";
  mainContent(round)
    .find("a")
    .each((index, element) => {
      let aLinkText = mainContent(element).text();
      if (typeof roundUrl[aLinkText] !== "undefined") {
        roundUrl[aLinkText] = mainContent(element).attr("href");
      }
    });

  const matchData = [];
  for (let matchRound in roundUrl) {
    const matchRoundUrl = `${baseUrl}${roundUrl[matchRound]}`;
    const matchRoundUrlData = await axios.get(matchRoundUrl);
    if (matchRoundUrlData.status !== 200) continue;

    const $ = cheerio.load(matchRoundUrlData.data);
    let dateTemp = "";
    const matchTable = "table.fixtures-results tbody tr";
    $(matchTable).each((trIndex, trElement) => {
      const row = [];
      $(trElement)
        .find("th, td")
        .each((tdIndex, tdElement) => {
          if ($(tdElement).is("th")) {
            dateTemp = $(tdElement)
              .text()
              .trim()
              .replace(/(\r\n|\n|\r|\t)/gm, "");
          } else if ($(tdElement).is("td")) {
            row.push(
              $(tdElement)
                .text()
                .trim()
                .replace(/(\r\n|\n|\r|\t)/gm, "")
            );
          }
        });
      if (row.length > 0) {
        row.unshift(dateTemp);
        row.unshift(matchRound);
        matchData.push(row);
      }
    });
  }

  const result = [];
  matchData.forEach((row) => {
    const datePart = row[1].match(/\d{2}\.\d{2}\.\d{4}/)[0];
    const dateParts = datePart.split(".");
    const formattedDate = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`;
    result.push({
      MD: cleanDate(row[0]),
      SN: cleanDate(row[2]),
      Date: cleanDate(formattedDate),
      Time: cleanDate(row[3]),
      HomeTeam: cleanDate(row[5]),
      AwayTeam: cleanDate(row[9]),
      Result: cleanDate(row[7]),
      Field: cleanDate(row[11]),
    });
  });

  return result;
};

const processMatchData = async () => {
  const year = new Date().getFullYear();
  const matchSchedule = await getMatchSchedule(year);

  if (matchSchedule.length <= 0) return;

  const conn = require("./connection.js");
  conn.query(
    "INSERT INTO wp_options (option_name, option_value) VALUES ('match_schedule', ?) ON DUPLICATE KEY UPDATE option_value = VALUES(option_value)",
    [JSON.stringify(matchSchedule)],
    (err, rows, fields) => {
      if (err) {
        console.log(err);
      }
      conn.end();
    }
  );
};

processMatchData();
return;

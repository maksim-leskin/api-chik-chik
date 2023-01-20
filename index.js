import { stat, readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:http";

const PORT = process.env.PORT || 2002;
import path from "path";
import * as url from "url";
const __dirname = url.fileURLToPath(new URL(".", import.meta.url));
const specDB = path.resolve(__dirname, "specDB.json");
const serviceDB = path.resolve(__dirname, "serviceDB.json");
const dateDB = path.resolve(__dirname, "dateDB.json");
const orderDB = path.resolve(__dirname, "orderDB.json");

const URI_PREFIX = "/api";

class ApiError extends Error {
  constructor(statusCode, data) {
    super();
    this.statusCode = statusCode;
    this.data = data;
  }
}

const drainJson = (req) =>
  new Promise((resolve) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
    });
    req.on("end", () => {
      resolve(JSON.parse(data));
    });
  });

const createOrder = (order) =>
  readFile(orderDB)
    .then((data) => {
      return JSON.parse(data);
    })
    .then(async (data) => {
      order.id =
        Math.random().toString(10).substring(2, 4) +
        Date.now().toString(10).substring(4, 6);
      order.createdAt = new Date().toGMTString();
      data.push(order);
      await writeFile(orderDB, JSON.stringify(data)).then((err) => {
        if (err) throw err;
        console.log("Orders has been saved!");
      });
      return order;
    });

const checkUpdateDB = async () => {
  try {
    const { mtimeMs } = await stat(dateDB);
    const now = Date.now();
    const hoursSinceModified = (now - mtimeMs) / 1000 / 60 / 60;
    return hoursSinceModified > 24;
  } catch (error) {
    console.error(error);
    return false;
  }
};

const getSpecificWeekdayDates = (monthsAhead, days) => {
  const today = new Date();
  let currentDate = new Date();
  currentDate.setDate(today.getDate() - 1);
  let specificWeekdayDates = [];
  const weekdays = new Set(days);

  for (let i = 0; i < monthsAhead; i++) {
    const daysInMonth = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth() + i + 1,
      0
    ).getDate();
    for (let j = 1; j <= daysInMonth; j++) {
      let date = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth() + i,
        j
      );
      if (weekdays.has(date.getDay()) && currentDate < date) {
        specificWeekdayDates.push({
          month: date.getMonth() + 1,
          day: date.getDate(),
        });
      }
    }
  }
  return specificWeekdayDates;
};

function randomElements(arr) {
  let numElements = Math.floor(Math.random() * 3) + 3;
  let output = [];
  let tempArr = [...arr].sort((a, b) => a - b);
  for (let i = 0; i < numElements; i++) {
    let randomIndex = Math.floor(Math.random() * tempArr.length);
    output.push(tempArr[randomIndex]);
    tempArr.splice(randomIndex, 1);
  }
  return output;
}

let array = [
  "10:00-11:30",
  "11:30-13:00",
  "13:00-14:30",
  "14:30-16:00",
  "16:00-17:30",
  "17:30-19:00",
  "19:00-20:30",
];

const work = {};

getSpecificWeekdayDates(3, [3]).forEach((item) => {
  work[item] = randomElements(array);
});

const updateDB = async () => {
  if (await checkUpdateDB()) {
    console.log("start update db");
    readFile(specDB)
      .then((data) => {
        const jsonData = JSON.parse(data);

        jsonData.map((item) => {
          item.work = {};
          getSpecificWeekdayDates(3, item.days).forEach(({ month, day }) => {
            if (!item.work[month]) {
              item.work[month] = {};
            }

            item.work[month][day] = randomElements(array);
          });
        });

        return writeFile(dateDB, JSON.stringify(jsonData));
      })
      .then(() => console.log("File successfully modified"))
      .catch((error) => console.error(error));
  }

  setTimeout(updateDB, 43200000);
};

updateDB();

const getService = async (param) => {
  if (!Object.keys(param).length) {
    return readFile(serviceDB).then((data) => JSON.parse(data));
  }

  if (param.service) {
    return readFile(specDB)
      .then((data) => JSON.parse(data))
      .then((data) =>
        data
          .filter(({ service }) => service.includes(+param.service))
          .map(({ id, img, name }) => ({
            id,
            img,
            name,
          }))
      );
  }

  if (param.spec && param.month && param.day) {
    return readFile(dateDB)
      .then((data) => JSON.parse(data))
      .then((data) =>
        data
          .find(({ id }) => id === +param.spec)
          .work[param.month][param.day].sort((a, b) => (a > b ? 1 : -1))
      )
      .then((data) =>
        readFile(orderDB)
          .then((res) => {
            return JSON.parse(res);
          })
          .then((orders) => {
            console.log("orders: ", orders);
            const timeList = [];

            orders.forEach((item) => {
              console.log("item: ", item);
              if (
                item.spec === param.spec &&
                item.month === param.month &&
                item.day === param.day
              ) {
                timeList.push(item.time);
              }
            });

            const result = data.filter((item) => !timeList.includes(item));
            return result;
          })
      );
  }

  if (param.spec && param.month) {
    return readFile(dateDB)
      .then((data) => JSON.parse(data))
      .then((data) => data.find(({ id }) => id === +param.spec).work)
      .then((work) => Object.keys(work[param.month]));
  }

  if (param.spec) {
    return readFile(dateDB)
      .then((data) => JSON.parse(data))
      .then((data) => data.find(({ id }) => id === +param.spec).work)
      .then((work) => Object.keys(work));
  }
  return;
};

createServer(async (req, res) => {
  if (req.url.substring(1, 4) === "img") {
    res.statusCode = 200;
    res.setHeader("Content-Type", "image/jpeg");
    readFile(`${__dirname}${req.url}`).then((image) => {
      res.end(image);
    });
    return;
  }

  res.setHeader("Content-Type", "application/json");

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.end();
    return;
  }

  try {
    if (req.method === "POST" && req.url === "/api/order") {
      const order = await createOrder(await drainJson(req));
      res.statusCode = 201;
      res.setHeader("Access-Control-Expose-Headers", "Location");
      res.setHeader("Location", `api/order/${order.id}`);
      res.end(JSON.stringify(order));
      return;
    }
  } catch (err) {
    console.log("err: ", err);

    if (err instanceof ApiError) {
      res.writeHead(err.statusCode);
      res.end(JSON.stringify(err.data));
    } else {
      res.statusCode = 500;
      res.end(JSON.stringify({ message: "Server Error" }));
    }
  }
  if (!req.url || !req.url.startsWith(URI_PREFIX)) {
    res.statusCode = 404;
    res.end(JSON.stringify({ message: "Not Found" }));
    return;
  }

  const [uri, query] = req.url.substring(URI_PREFIX.length).split("?");
  const queryParams = {};
  if (query) {
    for (const piece of query.split("&")) {
      const [key, value] = piece.split("=");
      queryParams[key] = value ? decodeURIComponent(value) : "";
    }
  }

  try {
    const body = await (async () => {
      const postPrefix = uri.substring(1);
      console.log("postPrefix: ", postPrefix);

      if (req.method !== "GET") return;
      if (uri === "" || uri === "/") {
        return await getService(queryParams);
      }

      return getService(postPrefix);
    })();
    res.end(JSON.stringify(body));
  } catch (err) {
    console.log("err: ", err);
    if (err instanceof ApiError) {
      res.writeHead(err.statusCode);
      res.end(JSON.stringify(err.data));
    } else {
      res.statusCode = 500;
      res.end(JSON.stringify({ message: "Server Error" }));
    }
  }
})
  .on("listening", () => {
    if (process.env.NODE_ENV !== "test") {
      console.log(
        `Сервер Chik-chik запущен. Вы можете использовать его по адресу http://localhost:${PORT}`
      );
      console.log("Нажмите CTRL+C, чтобы остановить сервер");
      console.log("Доступные методы:");
      console.log(`GET ${URI_PREFIX} - получить список услуг`);
      console.log(`GET ${URI_PREFIX}?service={n} - получить список барберов`);
      console.log(
        `GET ${URI_PREFIX}?spec={n} - получить список месяца работы барбера`
      );
      console.log(
        `GET ${URI_PREFIX}?spec={n}&month={n} - получить список дней работы барбера`
      );
      console.log(
        `GET ${URI_PREFIX}?spec={n}&month={n}&day={n} - получить список свободных часов барбера`
      );
      console.log(`POST /api/order - оформить заказ`);
    }
  })
  .listen(PORT);

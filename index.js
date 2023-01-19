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
  if (!(await checkUpdateDB())) {
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
  console.log("param: ", param);
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
      .then(
        (data) =>
          data.find(({ id }) => id === +param.spec).work[param.month][param.day]
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
  // req - объект с информацией о запросе, res - объект для управления отправляемым ответом
  // чтобы не отклонять uri с img
  if (req.url.substring(1, 4) === "img") {
    res.statusCode = 200;
    res.setHeader("Content-Type", "image/jpeg");
    readFile(`${__dirname}${req.url}`).then((image) => {
      res.end(image);
    });
    return;
  }

  // этот заголовок ответа указывает, что тело ответа будет в JSON формате
  res.setHeader("Content-Type", "application/json");

  // CORS заголовки ответа для поддержки кросс-доменных запросов из браузера
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // запрос с методом OPTIONS может отправлять браузер автоматически для проверки CORS заголовков
  // в этом случае достаточно ответить с пустым телом и этими заголовками
  if (req.method === "OPTIONS") {
    // end = закончить формировать ответ и отправить его клиенту
    res.end();
    return;
  }

  try {
    if (req.method === "POST" && req.url === "/api/order") {
      const order = await createOrder(await drainJson(req));
      console.log("order: ", order);
      res.statusCode = 201;
      res.setHeader("Access-Control-Expose-Headers", "Location");
      res.setHeader("Location", `api/order/${order.id}`);
      res.end(JSON.stringify(order));
      return;
    }
  } catch (err) {
    console.log("err: ", err);
    // обрабатываем сгенерированную нами же ошибку
    if (err instanceof ApiError) {
      res.writeHead(err.statusCode);
      res.end(JSON.stringify(err.data));
    } else {
      // если что-то пошло не так - пишем об этом в консоль и возвращаем 500 ошибку сервера
      res.statusCode = 500;
      res.end(JSON.stringify({ message: "Server Error" }));
    }
  }
  // если URI не начинается с нужного префикса - можем сразу отдать 404
  if (!req.url || !req.url.startsWith(URI_PREFIX)) {
    res.statusCode = 404;
    res.end(JSON.stringify({ message: "Not Found" }));
    return;
  }

  // убираем из запроса префикс URI, разбиваем его на путь и параметры
  const [uri, query] = req.url.substring(URI_PREFIX.length).split("?");
  const queryParams = {};
  // параметры могут отсутствовать вообще или иметь вид a=b&b=c
  // во втором случае наполняем объект queryParams { a: 'b', b: 'c' }
  if (query) {
    for (const piece of query.split("&")) {
      const [key, value] = piece.split("=");
      queryParams[key] = value ? decodeURIComponent(value) : "";
    }
  }

  try {
    // обрабатываем запрос и формируем тело ответа

    const body = await (async () => {
      const postPrefix = uri.substring(1);
      console.log("postPrefix: ", postPrefix);

      if (req.method !== "GET") return;
      if (uri === "" || uri === "/") {
        // /api/goods
        return await getService(queryParams);
      }

      return getService(postPrefix);
    })();
    res.end(JSON.stringify(body));
  } catch (err) {
    console.log("err: ", err);
    // обрабатываем сгенерированную нами же ошибку
    if (err instanceof ApiError) {
      res.writeHead(err.statusCode);
      res.end(JSON.stringify(err.data));
    } else {
      // если что-то пошло не так - пишем об этом в консоль и возвращаем 500 ошибку сервера
      res.statusCode = 500;
      res.end(JSON.stringify({ message: "Server Error" }));
    }
  }
})
  // выводим инструкцию, как только сервер запустился...
  .on("listening", () => {
    if (process.env.NODE_ENV !== "test") {
      console.log(
        `Сервер Chik-chik запущен. Вы можете использовать его по адресу http://localhost:${PORT}`
      );
      console.log("Нажмите CTRL+C, чтобы остановить сервер");
      console.log("Доступные методы:");
      console.log(`GET ${URI_PREFIX} - получить список услуг`);
      console.log(`GET ${URI_PREFIX}?/service={n} - получить список барберов`);
      console.log(
        `GET ${URI_PREFIX}?/spec={n} - получить список месяца работы барбера`
      );
      console.log(
        `GET ${URI_PREFIX}?/spec={n}&month={n} - получить список дней работы барбера`
      );
      console.log(
        `GET ${URI_PREFIX}?/spec={n}&month={n}&day={n} - получить список дней работы барбера`
      );
      console.log(`POST /api/order - оформить заказ`);
    }
  })
  // ...и вызываем запуск сервера на указанном порту
  .listen(PORT);

/*
import { readFileSync, readFile, writeFile } from "node:fs";

import path from "path";
import * as url from "url";
const __dirname = url.fileURLToPath(new URL(".", import.meta.url));
const DB_FILE = path.resolve(__dirname, "db.json");

const db = JSON.parse(readFileSync(DB_FILE) || "[]");
const orders = JSON.parse(readFileSync(ORDER_FILE) || "[]");





const shuffle = (array) => {
  const shuffleArray = [...array];
  for (let i = shuffleArray.length - 1; i > 0; i--) {
    let j = Math.floor(Math.random() * (i + 1));
    [shuffleArray[i], shuffleArray[j]] = [shuffleArray[j], shuffleArray[i]];
  }

  return shuffleArray;
};



const pagination = (data, page, count) => {
  const end = count * page;
  const start = page === 1 ? 0 : end - count;
  const totalCount = data.length;

  const pages = Math.ceil(data.length / count);

  return {
    goods: data.slice(start, end),
    page,
    pages,
    totalCount,
  };
};

const getGoodsList = (params) => {
  const keys = Object.keys(params);
  if (keys.length) {
    const isKeys = keys.every((item) =>
      [
        "page",
        "count",
        "gender",
        "category",
        "type",
        "search",
        "list",
      ].includes(item)
    );

    if (!isKeys) {
      throw new ApiError(403, { message: "Fail Params" });
    }
  }

  const page = +params.page || 1;
  let paginationCount = +params.count || 12;

  let data = [...db.goods];

  if (params.gender) {
    if (params.gender === "all") {
      paginationCount = +params.count || 4;
    } else {
      data = data.filter((item) => item.gender === params.gender);
      paginationCount = +params.count || 8;
    }

    if (!params.category) {
      data = data.filter((item) => item.top);
      data = shuffle(data);
      data.length = paginationCount;
      return data;
    }
  }

  if (params.category) {
    if (!params.gender)
      throw new ApiError(403, { message: "Not gender params" });
    data = data.filter((item) => item.category === params.category);
  }

  if (params.type) {
    data = data.filter((item) => item.type === params.type);
  }

  if (params.search) {
    const search = params.search.trim().toLowerCase();
    data = db.goods.filter((item) => {
      return (
        item.title.toLowerCase().includes(search) ||
        item.description.toLowerCase().includes(search)
      );
    });
  }

  if (params.list) {
    const list = params.list.trim().toLowerCase();
    return db.goods.filter((item) => list.includes(item.id));
  }

  return pagination(data, page, paginationCount);
};

const getItems = (itemId) => {
  const item = db.goods.find(({ id }) => id === itemId);
  if (!item) throw new ApiError(404, { message: "Item Not Found" });
  return item;
};


  */

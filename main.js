(async () => {
  const res = await fetch("./orderDB.json");

  if (!res.ok) {
    document.body.insertAdjacentHTML(
      "beforeend",
      `
    <p>Ошибка</p>
    <p>${res.status}</p>
    <p>${res.statusText}</p>
    `
    );
    return;
  }

  document.head.insertAdjacentHTML(
    "beforeend",
    `
    <style>
      table, th, td {
        border: 1px solid black;
        border-collapse: collapse;
      }

      th, td {
        padding: 3px 8px;
      }

      th {
        background-color: lightgray;
      }
    </style>
  `
  );

  const data = await res.json();

  const table = document.createElement("table");
  document.body.append(table);
  const thead = document.createElement("thead");
  const tbody = document.createElement("tbody");
  table.append(thead, tbody);
  thead.insertAdjacentHTML(
    "beforebegin",
    `
    <tr>
      <th>id</th>
      <th>createdAt</th>
      <th>service</th>
      <th>spec</th>
      <th>month</th>
      <th>day</th>
      <th>time</th>
    </tr>
  `
  );

  data.forEach((order) => {
    tbody.insertAdjacentHTML(
      "beforebegin",
      `
    <tr>
      <td>${order.id}</td>
      <td>${order.createdAt}</td>
      <td>${order.service}</td>
      <td>${order.spec}</td>
      <td>${order.month}</td>
      <td>${order.day}</td>
      <td>${order.time}</td>
    </tr>
    `
    );
  });
})();

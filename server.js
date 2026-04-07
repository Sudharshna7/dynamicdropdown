const express = require("express");
const app = express();

app.get("/tasks", (req, res) => {

  const params = req.query;

  // 1️⃣ Tempo verification
  if (params.tempoVerificationToken) {
    res.setHeader("X-Tempo-Verification-Token", params.tempoVerificationToken);
    return res.status(200).send("Tempo verification token received");
  }

  const callback = params.callback || "fn";

  // 2️⃣ Detect cascading attribute parameter
  let fieldName, fieldValue;
  for (const [k, v] of Object.entries(params)) {
    if (k === "callback" || k === "tempoVerificationToken") continue;
    fieldName = k;
    fieldValue = v;
    break;
  }

  let values = [];

  // 3️⃣ Cascading logic
  switch (fieldName) {

    case "firstAttr":
        if (fieldValue === "PS") {
            values = [
            { key: "1a", value: "1a" },
            { key: "1b", value: "1b" }
            ];
        }
        else if (fieldValue === "NPS") {
            values = [
            { key: "2a", value: "2a" },
            { key: "2b", value: "2b" }
            ];
        }
        else if (fieldValue === "f934440e-1edd-4789-9464-de5027b5acd2") {
            values = [
            { key: "3a", value: "3a" },
            { key: "3b", value: "3b" }
            ];
        }
        break;

    case "secondAttr":
      values = [
        { key: "A", value: "Option A" },
        { key: "B", value: "Option B" }
      ];
      break;

    default:
      // Root dropdown
      values = [
        { key: "1", value: "Category 1" },
        { key: "2", value: "Category 2" },
        { key: "3", value: "Category 3" }
      ];
  }

  // 4️⃣ JSONP response (Tempo requirement)
  const response = `${callback}(${JSON.stringify({ values })})`;

  res.setHeader("Content-Type", "application/javascript");
  res.status(200).send(response);
});

app.listen(3000, () => {
  console.log("Tempo dropdown API running on port 3000");
});
 
const express = require("express");
const app = express();

app.get("/tasks", (req, res) => {

  const params = req.query;

  if (params.tempoVerificationToken) {
    res.setHeader("X-Tempo-Verification-Token", params.tempoVerificationToken);
    return res.status(200).send("Tempo verification token received");
  }

  const callback = params.callback || "fn";

  let fieldName, fieldValue;
  for (const [k, v] of Object.entries(params)) {
    if (k === "callback" || k === "tempoVerificationToken") continue;
    fieldName = k;
    fieldValue = v;
    break;
  }

  let values = [];

  switch (fieldName) {

    case "firstAttr":
        if (fieldValue === "f2d236ad-b8a8-42f3-aed4-e46b6d81288c") {
            values = [
            { key: "Agile Ceremonies and Project Management", value: "Agile Ceremonies and Project Management" },
            { key: "New Feature Development", value: "New Feature Development" }
            ];
        }
        else if (fieldValue === "3f3c1a34-a76e-45b1-87ca-063dbe62d44b") {
            values = [
            { key: "Defect Resolution - Externally Found", value: "Defect Resolution - Externally Found" },
            { key: "Post Deployment Support", value: "Post Deployment Support" }
            ];
        }
        else if (fieldValue === "f934440e-1edd-4789-9464-de5027b5acd2") {
            values = [
            { key: "Concept and Release Planning", value: "Concept and Release Planning" },
            { key: "Product and Solution Testing", value: "Product and Solution Testing" }
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
      values = [
        { key: "1", value: "Category 1" },
        { key: "2", value: "Category 2" },
        { key: "3", value: "Category 3" }
      ];
  }

  const response = `${callback}(${JSON.stringify({ values })})`;

  res.setHeader("Content-Type", "application/javascript");
  res.status(200).send(response);
});

app.listen(3000, () => {
  console.log("Tempo dropdown API running on port 3000");
});
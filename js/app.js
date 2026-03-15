// Detect mobile and tablet devices by user agent
if (/Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
  // Replace the entire page with a desktop-only message
  document.body.innerHTML = `
    <div style="
      display:flex;
      justify-content:center;
      align-items:center;
      height:100vh; 
      font-family:sans-serif;
      text-align:center;
      padding:20px;
    ">
      <h2 style="font-size:clamp(1rem, 5vw, 2rem); color:#d32f2f;">
        Content is accessible only on desktop (PC).
      </h2>
    </div>
  `;
}

// Update Github Issues Modal

document.addEventListener("DOMContentLoaded", () => {
  const issuesList = document.getElementById("githubIssuesList");
  const issuesModal = document.getElementById("issuesModal");

  let cachedIssues = null;   // local memory
  let lastFetched = null;

  async function loadIssues() {
    // If cached and fetched within last 5 minutes, reuse
    if (cachedIssues && (Date.now() - lastFetched < 5 * 60 * 1000)) {
      renderIssues(cachedIssues);
      return;
    }

    try {
      const response = await fetch("https://api.github.com/repos/4ak4sh/gsrsdi/issues?state=all");
      cachedIssues = await response.json();
      lastFetched = Date.now();
      renderIssues(cachedIssues);
    } catch (err) {
      issuesList.innerHTML = "<li class='list-group-item text-danger'>Failed to load issues</li>";
      console.error("Error fetching issues:", err);
    }
  }

  function renderIssues(issues) {
    issuesList.innerHTML = "";
    if (issues.length === 0) {
      issuesList.innerHTML = "<li class='list-group-item'>No issues found</li>";
      return;
    }
    issues.forEach((issue, index) => {
      const li = document.createElement("li");
      li.className = "list-group-item d-flex justify-content-between align-items-center";
      li.innerHTML = `
        <a href="${issue.html_url}" target="_blank" class="text-decoration-none">
          #${issue.number} ${issue.title}
        </a>
        <span class="badge rounded-pill fw-bold text-uppercase bg-${issue.state === "open" ? "warning" : "success"}">
          ${issue.state === "open" ? "UNDER FIXING" : "FIXED"}
        </span>
      `;
      issuesList.appendChild(li);

      // staggered animation using index
      setTimeout(() => li.classList.add("show"), 100 * index);
    });

  }

  issuesModal.addEventListener("show.bs.modal", loadIssues);
});


function setActiveButton(activeId) {
  const diBtn = document.getElementById("diBtn");
  const mgIrtBtn = document.getElementById("mgIrtBtn");

  if (activeId === "diBtn") {
    diBtn.classList.add("active");
    mgIrtBtn.classList.remove("active");
    document.getElementById("mainContent").style.display = "block";
    document.getElementById("mgIrtContent").style.display = "none";
    document.getElementById("issueCount").innerHTML = `
      <span class="material-icons-outlined me-1" style="font-size:20px;">upload_file</span>
      <span>Upload DI file (CSV)</span>
    `;
  } else {
    mgIrtBtn.classList.add("active");
    diBtn.classList.remove("active");
    document.getElementById("mainContent").style.display = "none";
    document.getElementById("mgIrtContent").style.display = "block";
    document.getElementById("issueCount").innerHTML = `
      <span class="material-icons-outlined me-1" style="font-size:20px;">upload_file</span>
      <span>Upload DI & MG/IRT files (CSV)</span>
    `;
  }
}

document
  .getElementById("diBtn")
  .addEventListener("click", () => setActiveButton("diBtn"));
document
  .getElementById("mgIrtBtn")
  .addEventListener("click", () => setActiveButton("mgIrtBtn"));

// Global storage
let defectLogs = []; // all issues for export
let groupedErrors = {}; // grouped by rule

document.getElementById("csvFile").addEventListener("change", function (e) {
  const diFile = e.target.files[0];

  // ✅ Check file type (must be CSV)
  if (diFile.type !== "text/csv" && !diFile.name.endsWith(".csv")) {
    alert("Invalid file type. Please upload a CSV file.");
    this.value = ""; // reset input
    return;
  }

  Papa.parse(e.target.files[0], {
    header: true,
    skipEmptyLines: true,
    complete: function (results) {
      const data = results.data;

      // Reset globals
      groupedErrors = {};
      defectLogs = [];

      // Collect errors
      data.forEach((row, i) => {
        rules.forEach((rule) => {
          const r = rule(row);
          if (r.status !== "PASS") {
            if (!groupedErrors[r.rule]) groupedErrors[r.rule] = [];
            groupedErrors[r.rule].push({
              status: r.status,
              message: r.message,
              rowData: row,
            });

            defectLogs.push({
              Rule: r.rule,
              Status: r.status,
              Message: r.message,
              "GSR Global ID": row["GSR_GLOBAL_ID"] || "",
              "Local Code": row["Local Code"] || "",
              "Store Status": row["Status"] || "",
              Name: row["Name"] || "",
              Address: row["Address"] || "",
              City: row["City"] || "",
              State: row["State"] || "",
              "Postal Code": row["Postal Code"] || "",
              "Area Code": row["Area Code"] || "",
              "Phone Number": row["Phone"] || "",
              ...(r.rule === "Verification Date"
                ? { "Verification Date": row["Verification Date"] || "" }
                : {}),
              ...(r.rule === "Verification Source"
                ? { "Verification Source": row["Verification Source"] || "" }
                : {}),
            });
          }
        });
      });

      document.getElementById("diCardHead").classList.remove("bg-secondary")
      document.getElementById("diCardHead").classList.add("bg-primary")

      // Count total issues across all rules
      let totalIssues = defectLogs.length;

      // Update status bar with icon + text
      // document.getElementById("issueCount").innerHTML = `
      //   <span class="material-icons-outlined me-1" style="font-size:20px;">error_outline</span>
      //   <span>Total Issues: ${totalIssues}</span>
      // `;

      // Update card header (right side)
      document.getElementById("diIssueCount").innerHTML = `
        <span class="material-icons-outlined me-1" style="font-size:20px;">error_outline</span>
        <span>Total Issues: ${totalIssues}</span>
      `;

      // Build tab navigation
      let nav = `<ul class="nav nav-tabs" id="errorTabs" role="tablist">`;
      let content = `<div class="tab-content" id="errorTabsContent">`;
      let first = true;

      Object.keys(groupedErrors).forEach((ruleName, idx) => {
        const tabId = `tab-${idx}`;
        nav += `
          <li class="nav-item" role="presentation">
            <button class="nav-link ${first ? "active" : ""}" id="${tabId}-tab" data-bs-toggle="tab" data-bs-target="#${tabId}" type="button" role="tab">
              ${ruleName} (${groupedErrors[ruleName].length})
            </button>
          </li>
        `;

        let extraHeaders = "";
        if (ruleName === "Verification Date") {
          extraHeaders = "<th>Verification Date</th>";
        } else if (ruleName === "Verification Source") {
          extraHeaders = "<th>Verification Source</th>";
        } else if (ruleName === "Store Number") {
          extraHeaders = "<th>Store Number</th>";
        }

        content += `
  <div class="tab-pane fade ${first ? "show active" : ""}" id="${tabId}" role="tabpanel">
    <table class="table table-bordered table-striped mt-3">
      <thead class="table-light">
        <tr>
          <th>Message</th>
          <th>GSR Global ID</th>
          <th>Local Code</th>
          <th>Store Status</th>
          <th>Name</th>
          <th>Address</th>
          <th>City</th>
          <th>State</th>
          <th>Postal Code</th>
          <th>Area Code</th>
          <th>Phone Number</th>
          ${extraHeaders}
        </tr>
      </thead>
      <tbody>
`;

        groupedErrors[ruleName].forEach((err) => {
          const r = err.rowData;
          let statusClass = "";
          if (err.status === "FAIL") {
            statusClass = "table-danger";   // 🔴 red
          } else if (err.status === "WARN") {
            statusClass = "table-warning";  // 🟡 yellow
          }


          let extraCells = "";
          if (ruleName === "Verification Date") {
            extraCells = `<td>${r["Verification Date"] || ""}</td>`;
          } else if (ruleName === "Verification Source") {
            extraCells = `<td>${r["Verification Source"] || ""}</td>`;
          } else if (ruleName === "Store Number") {
            extraCells = `<td>${r["Store Number"] || ""}</td>`;
          }

          content += `<tr class="${statusClass}">
    <td>${err.message}</td>
    <td>${r["GSR_GLOBAL_ID"] || ""}</td>
    <td>${r["Local Code"] || ""}</td>
    <td>${r["Status"] || ""}</td>
    <td>${r["Name"] || ""}</td>
    <td>${r["Address"] || ""}</td>
    <td>${r["City"] || ""}</td>
    <td>${r["State"] || ""}</td>
    <td>${r["Postal Code"] || ""}</td>
    <td>${r["Area Code"] || ""}</td>
    <td>${r["Phone"] || ""}</td>
    ${extraCells}
  </tr>`;
        });

        content += `
              </tbody>
            </table>
          </div>
        `;
        first = false;
      });

      nav += `</ul>`;
      content += `</div>`;

      document.getElementById("results").innerHTML = nav + content;
      
    },
  });
});

// ✅ Export button handler: separate sheets per defect type
document.getElementById("exportBtn").addEventListener("click", function () {

  function safeSheetName(name) {
  // Replace forbidden characters with underscore and trim to 31 chars
  return name.replace(/[:\\/?*\[\]]/g, "_").substring(0, 31);
}
  
  console.log("export button clicked")
  console.log("Grouped Errors:", groupedErrors);


  if (!groupedErrors || Object.keys(groupedErrors).length === 0) {
    alert("No defect logs to export!");
    return;
  }

  const workbook = XLSX.utils.book_new();

  Object.keys(groupedErrors).forEach((ruleName) => {
    const rows = groupedErrors[ruleName].map((err) => {
      const r = err.rowData;
      return {
        Message: err.message,
        "GSR Global ID": r["GSR_GLOBAL_ID"] || "",
        "Local Code": r["Local Code"] || "",
        "Store Status": r["Status"] || "",
        Name: r["Name"] || "",
        Address: r["Address"] || "",
        City: r["City"] || "",
        State: r["State"] || "",
        "Postal Code": r["Postal Code"] || "",
        "Area Code": r["Area Code"] || "",
        "Phone Number": r["Phone"] || "",
        "Verification Date": r["Verification Date"] || "",
        "Verification Source": r["Verification Source"] || ""
      };
    });

    if (rows.length > 0) {
      const worksheet = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(workbook, worksheet, safeSheetName(ruleName));
    }
  });

  // Fallback if no sheets
  if (workbook.SheetNames.length === 0) {
    const ws = XLSX.utils.aoa_to_sheet([["No defects found"]]);
    XLSX.utils.book_append_sheet(workbook, ws, "Summary");
  }

  // Add today’s date to filename
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  const dateStr = `${yyyy}-${mm}-${dd}`;

  XLSX.writeFile(workbook, `DI_DefectLogs_${dateStr}.xlsx`);
});


document.getElementById("startBtn").addEventListener("click", function () {
  // Fade out slideshow
  document.getElementById("slideshow").classList.add("hidden");

  // Fade in main content
  document.getElementById("mainContent").classList.add("visible");

  // Set background image
  document.body.style.backgroundImage = "url('./assets/background.png')";

  // Update status bar with upload icon + text
  document.getElementById("issueCount").innerHTML = `
    <span class="material-icons-outlined me-1" style="font-size:20px;">upload_file</span>
    <span>Upload DI file (CSV)</span>
  `;

  // Hide Start button itself (optional)
  this.style.display = "none";
});

document.getElementById("startBtn").addEventListener("click", () => {
  document.getElementById("diBtn").style.display = "inline-block";
  document.getElementById("mgIrtBtn").style.display = "inline-block";
  setActiveButton("diBtn"); // make DI active by default
});

// document.getElementById('runValidation').addEventListener('click', () => {
//   const diFile = document.getElementById('diFile').files[0];
//   const mgIrtFile = document.getElementById('mgIrtFile').files[0];
//   runMgIrtValidation(diFile, mgIrtFile, document.getElementById('validationResults'));
// });

document.getElementById("clearBtn").addEventListener("click", function () {
  // Reset file input
  document.getElementById("csvFile").value = "";

  document.getElementById("diCardHead").classList.remove("bg-primary")
  document.getElementById("diCardHead").classList.add("bg-secondary")

  // Clear results area
  document.getElementById("results").innerHTML = "Upload DI file to display defects";

  // Reset status bar text back to upload prompt
  // document.getElementById("issueCount").innerHTML = `
  //   <span class="material-icons-outlined me-1" style="font-size:20px;">upload_file</span>
  //   <span>Upload DI file (CSV)</span>
  // `;

  document.getElementById("diIssueCount").innerHTML = "";

  // Reset global storage
  defectLogs = [];
  groupedErrors = {};

  // Optionally show a confirmation alert
  // alert("Validation results cleared!");
});

document.getElementById("diBtn").addEventListener("click", () => {
  document.getElementById("mainContent").style.display = "block";
  document.getElementById("mgIrtContent").style.display = "none";
  document.getElementById("diBtn").classList.add("btn-primary");
  document.getElementById("diBtn").classList.remove("btn-outline-primary");
  document.getElementById("mgIrtBtn").classList.add("btn-outline-primary");
  document.getElementById("mgIrtBtn").classList.remove("btn-primary");

  document.getElementById("issueCount").innerHTML = `
    <span class="material-icons-outlined me-1" style="font-size:20px;">upload_file</span>
    <span>Upload DI file (CSV)</span>
  `;
});

document.getElementById("mgIrtBtn").addEventListener("click", () => {
  document.getElementById("mainContent").style.display = "none";
  document.getElementById("mgIrtContent").style.display = "block";
  document.getElementById("mgIrtBtn").classList.add("btn-primary");
  document.getElementById("mgIrtBtn").classList.remove("btn-outline-primary");
  document.getElementById("diBtn").classList.add("btn-outline-primary");
  document.getElementById("diBtn").classList.remove("btn-primary");

  document.getElementById("issueCount").innerHTML = `
    <span class="material-icons-outlined me-1" style="font-size:20px;">upload_file</span>
    <span>Upload DI & MG/IRT files (CSV)</span>
  `;
});

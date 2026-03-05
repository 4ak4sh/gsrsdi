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




// Global storage
let defectLogs = [];       // all issues for export
let groupedErrors = {};    // grouped by rule

document.getElementById('csvFile').addEventListener('change', function(e) {
  Papa.parse(e.target.files[0], {
    header: true,
    complete: function(results) {
      const data = results.data;

      // Reset globals
      groupedErrors = {};
      defectLogs = [];

      // Collect errors
      data.forEach((row,i) => {
        rules.forEach(rule => {
          const r = rule(row);
          if (r.status !== "PASS") {
            if (!groupedErrors[r.rule]) groupedErrors[r.rule] = [];
            groupedErrors[r.rule].push({
              status: r.status,
              message: r.message,
              rowData: row
            });

            defectLogs.push({
              Rule: r.rule,
              Status: r.status,
              Message: r.message,
              "GSR Global ID": row["GSR_GLOBAL_ID"] || "",
              "Local Code": row["Local Code"] || "",
              "Store Status": row["Status"] || "",
              "Name": row["Name"] || "",
              "Address": row["Address"] || "",
              "City": row["City"] || "",
              "State": row["State"] || "",
              "Postal Code": row["Postal Code"] || "",
              "Area Code": row["Area Code"] || "",
              "Phone Number": row["Phone"] || ""
            });
          }
        });
      });

      // Count total issues across all rules
      let totalIssues = defectLogs.length;

      // Update status bar with icon + text
      document.getElementById('issueCount').innerHTML = `
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
            <button class="nav-link ${first ? 'active' : ''}" id="${tabId}-tab" data-bs-toggle="tab" data-bs-target="#${tabId}" type="button" role="tab">
              ${ruleName} (${groupedErrors[ruleName].length})
            </button>
          </li>
        `;

        content += `
          <div class="tab-pane fade ${first ? 'show active' : ''}" id="${tabId}" role="tabpanel">
            <table class="table table-bordered table-striped mt-3>
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
                </tr>
              </thead>
              <tbody>
        `;
        groupedErrors[ruleName].forEach(err => {
          const statusClass = err.status === "FAIL" ? "table-danger" : "table-warning";
          const r = err.rowData;
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

      document.getElementById('results').innerHTML = nav + content;
      // Enable sorting for all generated tables
      document.querySelectorAll('#results table').forEach(tbl => {
        new Tablesort(tbl);
      });

    }
  });
});


// ✅ Export button handler: separate sheets per defect type
document.getElementById('exportBtn').addEventListener('click', function() {
  if (!groupedErrors || Object.keys(groupedErrors).length === 0) {
    alert("No defect logs to export!");
    return;
  }

  const workbook = XLSX.utils.book_new();

  Object.keys(groupedErrors).forEach(ruleName => {
    const rows = groupedErrors[ruleName].map(err => {
      const r = err.rowData;
      return {
        Rule: ruleName,
        Status: err.status,
        Message: err.message,
        "GSR Global ID": r["GSR_GLOBAL_ID"] || "",
        "Local Code": r["Local Code"] || "",
        "Store Status": r["Status"] || "",
        "Name": r["Name"] || "",
        "Address": r["Address"] || "",
        "City": r["City"] || "",
        "State": r["State"] || "",
        "Postal Code": r["Postal Code"] || "",
        "Area Code": r["Area Code"] || "",
        "Phone Number": r["Phone"] || ""
      };
    });

    if (rows.length > 0) {
      const worksheet = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(workbook, worksheet, ruleName.substring(0,31));
    }
  });

  // Add today’s date to filename
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const dateStr = `${yyyy}-${mm}-${dd}`;

  XLSX.writeFile(workbook, `DefectLogs_${dateStr}.xlsx`);
});

document.getElementById('startBtn').addEventListener('click', function() {
  // Fade out slideshow
  document.getElementById('slideshow').classList.add('hidden');

  // Fade in main content
  document.getElementById('mainContent').classList.add('visible');

  // Set background image
  // document.body.style.backgroundImage = "url('./assets/background.png')";

  // Update status bar with upload icon + text
  document.getElementById('issueCount').innerHTML = `
    <span class="material-icons-outlined me-1" style="font-size:20px;">upload_file</span>
    <span>Upload DI file (CSV)</span>
  `;

  // Hide Start button itself (optional)
  this.style.display = 'none';
});




document.getElementById('clearBtn').addEventListener('click', function() {
  // Reset file input
  document.getElementById('csvFile').value = "";

  // Clear results area
  document.getElementById('results').innerHTML = "";

  // Reset issue count
  document.getElementById('issueCount').textContent = "Total Issues: 0";

  // Reset global storage
  defectLogs = [];
  groupedErrors = [];

  // Optionally show a confirmation alert
  // alert("Validation results cleared!");
});





// Run MG & IRT validation
document.getElementById("runValidation").addEventListener("click", () => {
  const diFile = document.getElementById("diFile").files[0];
  const mgIrtFile = document.getElementById("mgIrtFile").files[0];
  runMgIrtValidation(
    diFile,
    mgIrtFile,
    document.getElementById("validationResults"),
  );
});

function runMgIrtValidation(diFile, mgIrtFile, resultsContainer) {
  // ✅ Check if files are selected
  if (!diFile || !mgIrtFile) {
    alert("Please upload both DI and MG/IRT files.");
    return;
  }

  // ✅ Check file type (must be CSV)
  if (diFile.type !== "text/csv" || mgIrtFile.type !== "text/csv") {
    alert("Invalid file type. Please upload CSV files only.");
    return;
  }

  Promise.all([
    new Promise((resolve) =>
      Papa.parse(diFile, { header: true, complete: (r) => resolve(r.data) }),
    ),
    new Promise((resolve) =>
      Papa.parse(mgIrtFile, { header: true, complete: (r) => resolve(r.data) }),
    ),
  ]).then(([diData, mgIrtData]) => {
    let matches = [];

    diData.forEach((diRow) => {
      const diName = (diRow["Name"] || "").trim();
      const mgLocalCode = (diRow["MG Local Code"] || "").trim();

      // ✅ Only check rows where MG Local Code is blank
      if (!diName || mgLocalCode) return;

      mgIrtData.forEach((mgRow) => {
        const mgName = (mgRow["ACCOUNT_NAME"] || "").trim();
        if (!mgName) return;

        // ✅ Exact match only (no threshold)
        if (diName.toLowerCase() === mgName.toLowerCase()) {
          matches.push({
            diId: diRow["Local Code"] || "",
            diName,
            mgName,
            mgId: mgRow["TDLINX_ACCOUNT_CODE"] || "",
            irtId: mgRow["ACC_IMMEDIATE_REPORT_TO" || ""],
          });
        }
      });
    });

    // Render matches
    let html = `
      <table class="table table-bordered table-striped mt-3">
        <thead class="table-light">
          <tr>
            <th>Local Code (as per DI sheet)</th>
            <th>Name (as per DI sheet)</th>
            <th>MG/IRT Account Name</th>
            <th>MG Account ID</th>
            <th>IRT Account ID</th>
          </tr>
        </thead>
        <tbody>
          ${matches
            .map(
              (m) => `
            <tr class="table-success">
              <td>${m.diId}</td>
              <td>${m.diName}</td>
              <td>${m.mgName}</td>
              <td>${m.mgId}</td>
              <td>${m.irtId}</td>
            </tr>`,
            )
            .join("")}
        </tbody>
      </table>
    `;
    resultsContainer.innerHTML = html;
  });
}

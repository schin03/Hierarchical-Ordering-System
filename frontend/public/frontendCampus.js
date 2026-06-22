// --- Global state ---
let currentSort = { column: "name", direction: "asc" };
let availableBuildings = [];

// --- On page load ---
document.addEventListener("DOMContentLoaded", () => {
	loadData(); // Load existing data on page open
	document.getElementById("uploadBtnCampus").addEventListener("click", uploadZipFileCourse);
	document.getElementById("filterBtn").addEventListener("click", applyFilters);

	// Add click handlers for sortable column headers
	document.querySelectorAll("th.sortable").forEach((th) => {
		th.addEventListener("click", () => {
			const column = th.dataset.column;
			if (currentSort.column === column) {
				currentSort.direction = currentSort.direction === "asc" ? "desc" : "asc";
			} else {
				currentSort.column = column;
				currentSort.direction = "asc";
			}
			updateSortIndicators();
			applyFilters();
		});
	});
	updateSortIndicators();
});

// --- Update sort indicator on headers ---
function updateSortIndicators() {
	document.querySelectorAll("th.sortable").forEach((th) => {
		th.classList.remove("asc", "desc");
		if (th.dataset.column === currentSort.column) {
			th.classList.add(currentSort.direction);
		}
	});
}

// --- Upload a zip file ---
async function uploadZipFileCourse() {
	const fileInput = document.getElementById("zipFileCampus");
	const message = document.getElementById("message");
	const spinner = document.getElementById("spinner");
	const file = fileInput.files[0];

	// Clear previous message styling
	message.classList.remove("error", "success");

	if (!file) {
		message.textContent = "Error: Please select a ZIP file first.";
		message.classList.add("error");
		return;
	}

	if (!file.name.endsWith(".zip")) {
		message.textContent = "Error: Please select a valid .zip file.";
		message.classList.add("error");
		return;
	}

	const data = new FormData();
	data.append("kind", "facilities");
	data.append("archive", file, file.name);

	message.textContent = "Uploading...";
	spinner.classList.remove("hidden");

	try {
		const res = await fetch("/api/v2/datasets", { method: "POST", body: data });
		const job = await res.json();

		if (!res.ok) {
			spinner.classList.add("hidden");
			message.textContent = "Upload failed: " + (job.message || job.error || "Unknown error");
			message.classList.add("error");
			return;
		}

		message.textContent = "Processing...";

		const finalJob = await pollForCompletion(job.id);

		spinner.classList.add("hidden");

		if (finalJob.status === "completed") {
			const s = finalJob.stats;
			message.textContent =
				"Done! Buildings added: " +
				s.buildings_added +
				", modified: " +
				s.buildings_modified +
				". Rooms added: " +
				s.rooms_added +
				", modified: " +
				s.rooms_modified +
				".";
			message.classList.add("success");
			await loadData(); // Refresh the table
		} else {
			message.textContent = "Processing failed: " + (finalJob.message || "Unknown error");
			message.classList.add("error");
		}
	} catch (err) {
		spinner.classList.add("hidden");
		message.textContent = "Upload error: " + err.message;
		message.classList.add("error");
	}
}

// --- Poll job status until done ---
async function pollForCompletion(jobId) {
	while (true) {
		const res = await fetch("/api/v2/datasets/" + encodeURIComponent(jobId));
		const job = await res.json();

		if (job.status === "completed" || job.status === "failed") {
			return job;
		}

		await new Promise((resolve) => setTimeout(resolve, 500));
	}
}

// --- Load all data (or filtered data) into the table ---
async function loadData(where) {
	try {
		const query = {
			WHERE: where || {},
			OPTIONS: {
				COLUMNS: ["name", "address", "number", "type", "seats"],
				ORDER: currentSort.column,
			},
		};

		const res = await fetch("/api/v2/search", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ kind: "facilities", query: query }),
		});

		if (!res.ok) {
			console.error("Failed to load data:", await res.text());
			return;
		}

		let data = await res.json();

		// Apply client-side descending if needed (server does ascending)
		if (currentSort.direction === "desc") {
			data = data.reverse();
		}

		// Update available departments for the multi-select
		updateBuildingSelect(data);

		renderTable(data);
	} catch (err) {
		console.error("Error loading data:", err);
	}
}

// --- Update department multi-select options ---
function updateBuildingSelect(data) {
	const buildingSelect = document.getElementById("filterBuilding");
	const currentSelections = Array.from(buildingSelect.selectedOptions).map((o) => o.value);

	// Get unique departments from data
	const buildings = [...new Set(data.map((d) => d.name))].filter(Boolean).sort();

	// Only update if we have new departments
	if (buildings.length > availableBuildings.length) {
		availableBuildings = buildings;
		buildingSelect.innerHTML = availableBuildings
			.map((d) => `<option value="${d}" ${currentSelections.includes(d) ? "selected" : ""}>${d}</option>`)
			.join("");
	}
}

// --- Apply filters from the input fields ---
function applyFilters() {
	const buildingSelect = document.getElementById("filterBuilding");
	const selectedBuildings = Array.from(buildingSelect.selectedOptions).map((o) => o.value);
	const yearMin = document.getElementById("filterYearMin").value;
	const yearMax = document.getElementById("filterYearMax").value;

	// Build the WHERE clause based on filters
	const filters = [];

	// Department multi-select: OR together selected departments
	if (selectedBuildings.length === 1) {
		filters.push({ IS: { dept: selectedBuildings[0] } });
	} else if (selectedBuildings.length > 1) {
		filters.push({ OR: selectedBuildings.map((d) => ({ IS: { dept: d } })) });
	}

	// Year range filter
	if (yearMin) {
		filters.push({ GT: { year: parseInt(yearMin) - 1 } });
	}
	if (yearMax) {
		filters.push({ LT: { year: parseInt(yearMax) + 1 } });
	}

	// Instructor partial match

	let where = {};
	if (filters.length === 1) {
		where = filters[0];
	} else if (filters.length > 1) {
		where = { AND: filters };
	}

	loadData(where);
}

// --- Render data rows into the HTML table ---
function renderTable(data) {
	const tableBody = document.getElementById("dataTableBody");
	if (!tableBody) return;

	tableBody.innerHTML = data
		.map(
			(item) =>
				`<tr>
					<td>${item.name}</td>
					<td>${item.address}</td>
					<td>${item.number}</td>
					<td>${item.type}</td>
					<td>${item.seats}</td>
				</tr>`
		)
		.join("");
}

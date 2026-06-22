// --- Global state ---
let currentSort = { column: "avg", direction: "asc" };
let availableDepts = [];

// --- On page load ---
document.addEventListener("DOMContentLoaded", () => {
	loadData(); // Load existing data on page open
	document.getElementById("uploadBtnCourse").addEventListener("click", uploadZipFile);
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
async function uploadZipFile() {
	const fileInput = document.getElementById("zipFileCourse");
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
	data.append("kind", "course_offerings");
	data.append("archive", file, file.name);

	message.textContent = "Uploading...";
	spinner.classList.remove("hidden");

	try {
		const res = await fetch("/api/v1/datasets", { method: "POST", body: data });
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
				"Done! Courses added: " +
				s.courses_added +
				", modified: " +
				s.courses_modified +
				". Sections added: " +
				s.sections_added +
				", modified: " +
				s.sections_modified +
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
		const res = await fetch("/api/v1/datasets/" + encodeURIComponent(jobId));
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
				COLUMNS: ["dept", "code", "title", "year", "instructor", "avg"],
				ORDER: currentSort.column,
			},
		};

		const res = await fetch("/api/v1/search", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ kind: "course_offerings", query: query }),
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
		updateDeptSelect(data);

		renderTable(data);
	} catch (err) {
		console.error("Error loading data:", err);
	}
}

// --- Update department multi-select options ---
function updateDeptSelect(data) {
	const deptSelect = document.getElementById("filterDept");
	const currentSelections = Array.from(deptSelect.selectedOptions).map((o) => o.value);

	// Get unique departments from data
	const depts = [...new Set(data.map((d) => d.dept))].filter(Boolean).sort();

	// Only update if we have new departments
	if (depts.length > availableDepts.length) {
		availableDepts = depts;
		deptSelect.innerHTML = availableDepts
			.map((d) => `<option value="${d}" ${currentSelections.includes(d) ? "selected" : ""}>${d}</option>`)
			.join("");
	}
}

// --- Apply filters from the input fields ---
function applyFilters() {
	const deptSelect = document.getElementById("filterDept");
	const selectedDepts = Array.from(deptSelect.selectedOptions).map((o) => o.value);
	const instructor = document.getElementById("filterInstructor").value.trim();
	const yearMin = document.getElementById("filterYearMin").value;
	const yearMax = document.getElementById("filterYearMax").value;

	// Build the WHERE clause based on filters
	const filters = [];

	// Department multi-select: OR together selected departments
	if (selectedDepts.length === 1) {
		filters.push({ IS: { dept: selectedDepts[0] } });
	} else if (selectedDepts.length > 1) {
		filters.push({ OR: selectedDepts.map((d) => ({ IS: { dept: d } })) });
	}

	// Year range filter
	if (yearMin) {
		filters.push({ GT: { year: parseInt(yearMin) - 1 } });
	}
	if (yearMax) {
		filters.push({ LT: { year: parseInt(yearMax) + 1 } });
	}

	// Instructor partial match
	if (instructor) {
		filters.push({ IS: { instructor: "*" + instructor + "*" } });
	}

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
					<td>${item.dept}</td>
					<td>${item.code}</td>
					<td>${item.title}</td>
					<td>${item.year}</td>
					<td>${item.instructor}</td>
					<td>${item.avg}</td>
				</tr>`
		)
		.join("");
}

// GLOBAL STATE
let currentSort = {column: "seats", direction: "asc"};
let fullFacilityData = [];
let availableBuildings = [];
let insightChart = null;

document.addEventListener("DOMContentLoaded", () => {
	loadData();

	const buildingSelect = document.getElementById("filterBuilding");
	if (buildingSelect) {
		buildingSelect.addEventListener("change", updateChartForBuilding);
	}

	const filterBtn = document.getElementById("filterBtn");
	if (filterBtn) {
		filterBtn.addEventListener("click", applyFilters);
	}

});

document.querySelectorAll("#filterRoomType input").forEach(cb=> {
	cb.addEventListener("change", () => {
		updateBuildingSelect(fullFacilityData);
	});
});
const ctx = document.getElementById('insight2_chart');
if (ctx) {
	insightChart = new Chart(ctx,  {
		type: 'bar',
		data: {
			labels: [],
			datasets: [{
				label: 'Seats in Rooms',
				data: [],
				borderWidth: 1
			}]
		},
		options: {
			scales: {
				y: {
					beginAtZero: true
				}
			}
		}
	});

}



async function loadData (where) {
	try {
		const query = {
			WHERE: where || {},
			OPTIONS: {
				COLUMNS: ["name", "number", "seats", "type"],
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

		fullFacilityData = await res.json();

		// Apply client-side descending if needed (server does ascending)
		if (currentSort.direction === "desc") {
			data = data.reverse();
		}

		// Update available departments for the multi-select
		updateBuildingSelect(fullFacilityData);



	} catch (err) {
		console.error("Error loading data: ", err);
	}
}


// --- Update department multi-select options ---
function updateBuildingSelect(data) {
	const buildingSelect = document.getElementById("filterBuilding");

	const selectedTypes = Array.from(document.querySelectorAll("#filterRoomType input:checked")).map(cb => cb.value);

	let filteredData = data;
	if (selectedTypes.length > 0) {
		filteredData = data.filter(row => selectedTypes.includes(row.type) && row.seats && row.seats > 0);
	} else {
		filteredData = data.filter(row => row.seats && row.seats > 0);
	}

	// Get unique departments from data
	const buildings = [...new Set(filteredData.map(d=>d.name))].sort();

	const currentSelection = buildingSelect.value;

	buildingSelect.innerHTML = buildings
			.map((d) => `<option value="${d}" ${currentSelection.includes(d) ? "selected" : ""}>${d}</option>`)
			.join("");

	if (buildingSelect.value) updateChartForBuilding();
}

// update chart based on selected department
async function updateChartForBuilding() {
	const buildingSelect = document.getElementById("filterBuilding");
	const selectedBuilding = buildingSelect.value;

	if (!selectedBuilding) return;

	const where = {IS : {name: selectedBuilding}};

	try {
		const query = {
			WHERE: where,
			OPTIONS: {
				COLUMNS: ["name", "number", "seats"],
				ORDER: "number"
			}
		};

		const res = await fetch("/api/v2/search", {
			method: "POST",
			headers: {"Content-Type" : "application/json"},
			body: JSON.stringify({kind: "facilities", query: query}),
		});

		if (!res.ok) {
			console.error("Chart query failed:", await res.text());
		}

		const data = await res.json();

		const grouped = {};
		data.forEach(row => {
			if (!grouped[row.number]) {
				grouped[row.number] = {sum:0, count:0};
			}
			grouped[row.number].sum += row.seats;
			grouped[row.number].count += 1;
		});


		const labels = Object.keys(grouped).sort();
		const values = labels.map(number => grouped[number].sum/grouped[number].count);


		if (!insightChart) return;

		insightChart.data.labels = labels;
		insightChart.data.datasets[0].data = values;
		insightChart.update();

	} catch (err) {
		console.error("Error updating chart: ", err);
	}
}

function applyFilters() {
	const buildingSelect = document.getElementById("filterBuilding");
	const selectedBuildings = Array.from(buildingSelect.selectedOptions).map((o) => o.value);

	// Build the WHERE clause based on filters
	const filters = [];

	// Department multi-select: OR together selected departments
	if (selectedBuildings.length === 1) {
		filters.push({ IS: { name: selectedBuildings[0] } });
	} else if (selectedBuildings.length > 1) {
		filters.push({ OR: selectedBuildings.map((d) => ({ IS: { name: d } })) });
	}

	let where = {};
	if (filters.length === 1) {
		where = filters[0];
	} else if (filters.length > 1) {
		where = { AND: filters };
	}

	console.log(filters);
	loadData(where);
}


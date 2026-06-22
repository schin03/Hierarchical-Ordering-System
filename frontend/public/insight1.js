let insightChart = null;

document.addEventListener("DOMContentLoaded", () => {

	loadDepartments();


	document.getElementById("filterBtn").addEventListener("click", applyFilters);
});

const ctx = document.getElementById("insight1_chart");
if (ctx) {
	insightChart = new Chart(ctx, {
		type: "bar",
		data: {
			labels: [],
			datasets: [{
				label: "Average Grade",
				data: [],
				borderWidth: 1
			}]
		},
		options: {
			scales: {
				y: { beginAtZero: true, max: 100, title: { display: true, text: "Average" } },
				x: { title: { display: true, text: "Course Code" } }
			}
		}
	});
}

async function loadDepartments() {
	try {
		const res = await fetch("/api/v2/search", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				kind: "course_offerings",
				query: { WHERE: {}, OPTIONS: { COLUMNS: ["dept"], ORDER: "dept" } }
			})
		});
		if (!res.ok) return;
		const data = await res.json();
		const depts = [...new Set(data.map(d => d.dept))].filter(Boolean).sort();
		const select = document.getElementById("filterDept");
		select.innerHTML = '<option value="">-- select --</option>' +
			depts.map(d => `<option value="${d}">${d}</option>`).join("");
	} catch (err) {
		console.error("Error loading departments:", err);
	}
}

async function applyFilters() {
	const dept = document.getElementById("filterDept").value;
	if (!dept) return;

	const selectedLevels = Array.from(
		document.querySelectorAll("#filterYearLevel input:checked")
	).map(cb => cb.value);

	const filters = [{ IS: { dept: dept } }];

	if (selectedLevels.length > 0) {
		if (selectedLevels.length === 1) {
			filters.push({ IS: { code: selectedLevels[0] + "*" } });
		} else {
			filters.push({ OR: selectedLevels.map(l => ({ IS: { code: l + "*" } })) });
		}
	}


	const where = filters.length === 1 ? filters[0] : { AND: filters };


	try {
		const res = await fetch("/api/v2/search", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				kind: "course_offerings",
				query: { WHERE: where, OPTIONS: { COLUMNS: ["code", "avg"], ORDER: "code" } }
			})
		});
		if (!res.ok) {
			console.error("Query failed:", await res.text());
			return;
		}
		const data = await res.json();

		const grouped = {};
		data.forEach(row => {
			if (!grouped[row.code]) {
				grouped[row.code] = { sum: 0, count: 0 };
			}
			grouped[row.code].sum += row.avg;
			grouped[row.code].count += 1;
		});

		const labels = Object.keys(grouped).sort();
		const values = labels.map(c => +(grouped[c].sum / grouped[c].count).toFixed(2));

		insightChart.data.labels = labels.map(c => dept + " " + c);
		insightChart.data.datasets[0].data = values;
		insightChart.update();
	} catch (err) {
		console.error("Error applying filters:", err);
	}
}

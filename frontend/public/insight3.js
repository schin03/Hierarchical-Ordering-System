let insightChart = null;

document.addEventListener("DOMContentLoaded", () => {
	loadDepartments();

	document.getElementById("filterBtn").addEventListener("click", applyFilters);
});

const ctx = document.getElementById("insight3_chart");
if (ctx) {
	insightChart = new Chart(ctx, {
		type: "bar",
		data: {
			labels: [],
			datasets: [
				{
					label: "Pass",
					data: [],
					backgroundColor: "rgba(75, 192, 192, 0.7)",
					borderWidth: 1
				},
				{
					label: "Fail",
					data: [],
					backgroundColor: "rgba(255, 99, 132, 0.7)",
					borderWidth: 1
				}
			]
		},
		options: {
			scales: {
				y: { beginAtZero: true, title: { display: true, text: "Total Students" } },
				x: { title: { display: true, text: "Professor" } }
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
				query: {
					WHERE: where,
					OPTIONS: { COLUMNS: ["instructor", "pass", "fail"], ORDER: "instructor" }
				}
			})
		});
		if (!res.ok) {
			console.error("Query failed:", await res.text());
			return;
		}
		const data = await res.json();

		const grouped = {};
		data.forEach(row => {
			const prof = row.instructor;
			if (!prof) return;
			if (!grouped[prof]) {
				grouped[prof] = { pass: 0, fail: 0 };
			}
			grouped[prof].pass += row.pass;
			grouped[prof].fail += row.fail;
		});

		const labels = Object.keys(grouped).sort();
		const passValues = labels.map(p => grouped[p].pass);
		const failValues = labels.map(p => grouped[p].fail);

		insightChart.data.labels = labels;
		insightChart.data.datasets[0].data = passValues;
		insightChart.data.datasets[1].data = failValues;
		insightChart.update();
	} catch (err) {
		console.error("Error applying filters:", err);
	}
}

frappe.ui.form.on("Stock Taking", {
	onload(frm) {
		apply_warehouse_filter(frm);

		setTimeout(() => {
			let field = frm.fields_dict.scan_barcode;

			if (!field || !field.$input) return;

			// 🔥 remove old events
			field.$input.off("input");

			let scan_timer = null;

			field.$input.on("input", function (e) {
				let value = field.$input.val().trim();

				if (!value) return;

				// 🔥 debounce (scanner fast typing)
				clearTimeout(scan_timer);

				scan_timer = setTimeout(() => {
					process_scan(frm, value);

					// 🔥 HARD CLEAR (REAL FIX)
					field.$input.val("");
					field.$input.get(0).value = "";
					frm.doc.scan_barcode = "";

					// 🔥 keep focus
					field.$input.focus();
				}, 200); // 👈 important delay
			});

			// auto focus
			field.$input.focus();
		}, 500);
	},

	refresh(frm) {
		console.log("[Stock Taking] refresh triggered");
		apply_warehouse_filter(frm);
		update_total_quantity(frm);
	},

	company(frm) {
		console.log("[Stock Taking] company changed →", frm.doc.company);
		frm.set_value("warehouse", "");
		frm.clear_table("items");
		frm.refresh_field("items");
		apply_warehouse_filter(frm);
	},

	stock_selection(frm) {
		console.log("[Stock Taking] stock_selection changed →", frm.doc.stock_selection);
		frm.set_value("warehouse", "");
		// frm.clear_table('items');
		frm.refresh_field("items");
		apply_warehouse_filter(frm);
	},

	warehouse(frm) {
		console.log("[Stock Taking] warehouse selected →", frm.doc.warehouse);
		// frm.clear_table("items");
		frm.refresh_field("items");
	},

	// Calculate differences before saving (keeps UI responsive)
	before_save(frm) {
		// calculate_differences(frm);
		update_child_warehouse(frm);
	},

	//warehouse wise serial no physical active/delivered
	// async before_submit(frm) {

	//     frappe.validated = false;

	//     try {

	//         let issue_items = [];
	//         let receipt_items = [];

	//         // =====================================
	//         // ✅ ALL SCANNED SERIALS (WHOLE WAREHOUSE)
	//         // =====================================
	//         let warehouse_scanned = {};

	//         // =====================================
	//         // ✅ STORE SCANNED ITEM DATA
	//         // =====================================
	//         let scanned_item_map = {};

	//         for (let row of (frm.doc.items || [])) {

	//             if (!row.warehouse) {
	//                 frappe.throw(`Warehouse missing for item ${row.item_code}`);
	//             }

	//             let warehouse = row.warehouse;

	//             // =====================================
	//             // ✅ SERIALS
	//             // =====================================
	//             let serials = row.serial_no
	//                 ? row.serial_no
	//                     .split("\n")
	//                     .map(s => s.trim())
	//                     .filter(Boolean)
	//                 : [];

	//             // =====================================
	//             // ✅ WAREHOUSE SCANNED SERIALS
	//             // =====================================
	//             if (!warehouse_scanned[warehouse]) {
	//                 warehouse_scanned[warehouse] = [];
	//             }

	//             warehouse_scanned[warehouse].push(...serials);

	//             // =====================================
	//             // ✅ ITEM MAP
	//             // =====================================
	//             let key = `${row.item_code}__${warehouse}`;

	//             if (!scanned_item_map[key]) {

	//                 scanned_item_map[key] = {
	//                     item_code: row.item_code,
	//                     warehouse: warehouse,
	//                     serials: [],
	//                     inventory: 0,
	//                     physical_count: 0
	//                 };
	//             }

	//             scanned_item_map[key].serials.push(...serials);

	//             scanned_item_map[key].inventory +=
	//                 flt(row.inventory);

	//             scanned_item_map[key].physical_count +=
	//                 flt(row.physical_count);
	//         }

	//         // =====================================
	//         // ✅ REMOVE DUPLICATES
	//         // =====================================
	//         for (let wh in warehouse_scanned) {

	//             warehouse_scanned[wh] = [
	//                 ...new Set(warehouse_scanned[wh])
	//             ];
	//         }

	//         // =====================================
	//         // 🔥 SERIALIZED ITEM ISSUE
	//         // =====================================
	//         for (let warehouse in warehouse_scanned) {

	//             let scanned_serials =
	//                 warehouse_scanned[warehouse];

	//             let r = await frappe.call({
	//                 method: "stock_taking.stock_taking.doctype.stock_taking.stock_taking.get_warehouse_serials",
	//                 args: {
	//                     warehouse: warehouse
	//                 }
	//             });

	//             let warehouse_serials = r.message || [];

	//             // =====================================
	//             // 🔻 NOT SCANNED SERIALS
	//             // =====================================
	//             let missing_serials = warehouse_serials.filter(
	//                 s => !scanned_serials.includes(s.serial_no)
	//             );

	//             missing_serials.forEach(d => {

	//                 issue_items.push({
	//                     item_code: d.item_code,
	//                     warehouse: warehouse,
	//                     serial_no: d.serial_no,
	//                     qty: 1
	//                 });
	//             });
	//         }

	//         // =====================================
	//         // 🔥 NON SERIALIZED ISSUE
	//         // WHOLE WAREHOUSE
	//         // =====================================
	//         for (let warehouse in warehouse_scanned) {

	//             // =====================================
	//             // 🔥 GET ALL NON SERIAL ITEMS
	//             // =====================================
	//             let r = await frappe.call({
	//                 method: "stock_taking.stock_taking.doctype.stock_taking.stock_taking.get_non_serialized_stock",
	//                 args: {
	//                     warehouse: warehouse
	//                 }
	//             });

	//             let warehouse_items = r.message || [];

	//             warehouse_items.forEach(stock_item => {

	//                 let key =
	//                     `${stock_item.item_code}__${warehouse}`;

	//                 // =====================================
	//                 // ✅ SCANNED QTY
	//                 // =====================================
	//                 let scanned_qty = 0;

	//                 if (scanned_item_map[key]) {

	//                     scanned_qty =
	//                         flt(scanned_item_map[key].physical_count);
	//                 }

	//                 // =====================================
	//                 // ✅ SYSTEM QTY
	//                 // =====================================
	//                 let system_qty =
	//                     flt(stock_item.actual_qty);

	//                 // =====================================
	//                 // 🔻 DIFFERENCE
	//                 // =====================================
	//                 let difference =
	//                     system_qty - scanned_qty;

	//                 if (difference > 0) {

	//                     issue_items.push({

	//                         item_code: stock_item.item_code,

	//                         warehouse: warehouse,

	//                         serial_no: "",

	//                         qty: difference
	//                     });
	//                 }
	//             });
	//         }

	//         // =====================================
	//         // 🔺 RECEIPT LOGIC
	//         // =====================================
	//         for (let key in scanned_item_map) {

	//             let data = scanned_item_map[key];

	//             // =====================================
	//             // ✅ SERIALIZED ITEM RECEIPT
	//             // =====================================
	//             if (data.serials.length > 0) {

	//                 let r = await frappe.call({
	//                     method: "stock_taking.stock_taking.doctype.stock_taking.stock_taking.get_system_serials",
	//                     args: {
	//                         item_code: data.item_code,
	//                         warehouse: data.warehouse
	//                     }
	//                 });

	//                 let system_serials = (r.message || [])
	//                     .map(s => s.trim());

	//                 // =====================================
	//                 // ✅ EXTRA SERIALS
	//                 // =====================================
	//                 let extra = data.serials.filter(
	//                     s => !system_serials.includes(s)
	//                 );

	//                 if (extra.length > 0) {

	//                     receipt_items.push({
	//                         item_code: data.item_code,
	//                         warehouse: data.warehouse,
	//                         serial_no: extra.join("\n"),
	//                         qty: extra.length
	//                     });
	//                 }
	//             }

	//             // =====================================
	//             // ✅ NON SERIALIZED ITEM RECEIPT
	//             // =====================================
	//             else {

	//                 let r = await frappe.call({
	//                     method: "stock_taking.stock_taking.doctype.stock_taking.stock_taking.get_non_serialized_stock",
	//                     args: {
	//                         warehouse: data.warehouse
	//                     }
	//                 });

	//                 let warehouse_items = r.message || [];

	//                 let system_qty = 0;

	//                 let stock_row = warehouse_items.find(d =>
	//                     d.item_code === data.item_code
	//                 );

	//                 if (stock_row) {
	//                     system_qty = flt(stock_row.actual_qty);
	//                 }

	//                 let physical_qty =
	//                     flt(data.physical_count);

	//                 // =====================================
	//                 // ✅ EXTRA PHYSICAL QTY
	//                 // =====================================
	//                 let extra_qty =
	//                     physical_qty - system_qty;

	//                 if (extra_qty > 0) {

	//                     receipt_items.push({

	//                         item_code: data.item_code,

	//                         warehouse: data.warehouse,

	//                         serial_no: "",

	//                         qty: extra_qty
	//                     });
	//                 }
	//             }
	//         }
	//         // =====================================
	//         // 🔥 CREATE ISSUE
	//         // =====================================
	//         if (issue_items.length > 0) {

	//             await create_stock_entry(
	//                 frm,
	//                 "Material Issue",
	//                 issue_items
	//             );
	//         }

	//         // =====================================
	//         // 🔥 CREATE RECEIPT
	//         // =====================================
	//         if (receipt_items.length > 0) {

	//             await create_stock_entry(
	//                 frm,
	//                 "Material Receipt",
	//                 receipt_items
	//             );
	//         }

	//         frappe.validated = true;

	//     } catch (err) {

	//         console.error(err);

	//         frappe.validated = false;

	//         frappe.throw(
	//             "Stock Entry Error: " +
	//             (err.message || err)
	//         );
	//     }
	// }

	async before_submit(frm) {
		// =====================================================
		// PREVENT DOUBLE SUBMIT
		// =====================================================

		if (frm.__stock_taking_submit_in_progress) {
			frappe.msgprint({
				title: __("Please Wait"),
				message: __("Stock Taking submission is already in progress."),
				indicator: "orange",
			});

			frappe.validated = false;
			return;
		}

		frm.__stock_taking_submit_in_progress = true;

		frm.disable_save();

		// =====================================================
		// CUSTOM CENTER LOADER
		// =====================================================

		show_stock_taking_loader("Create Delivery Note", "Please wait...");

		frappe.validated = false;

		try {
			// =====================================================
			// ALL DELIVERY NOTE ITEMS
			// =====================================================

			let delivery_note_items = [];

			// =====================================================
			// ALL RETURN ITEMS
			// =====================================================

			let receipt_items = [];

			// =====================================================
			// STORE SCANNED SERIALS BY WAREHOUSE
			// =====================================================

			let warehouse_scanned = {};

			// =====================================================
			// STORE SCANNED ITEM DATA
			// =====================================================

			let scanned_item_map = {};

			// =====================================================
			// READ STOCK TAKING ITEMS
			// =====================================================

			for (let row of frm.doc.items || []) {
				if (!row.warehouse) {
					frappe.throw(`Warehouse missing for item ${row.item_code}`);
				}

				let warehouse = row.warehouse;

				let serials = row.serial_no
					? String(row.serial_no)
							.split("\n")
							.map((s) => s.trim())
							.filter(Boolean)
					: [];

				if (!warehouse_scanned[warehouse]) {
					warehouse_scanned[warehouse] = [];
				}

				warehouse_scanned[warehouse].push(...serials);

				let key = `${row.item_code}__${warehouse}`;

				if (!scanned_item_map[key]) {
					scanned_item_map[key] = {
						item_code: row.item_code,
						warehouse: warehouse,
						serials: [],
						inventory: 0,
						physical_count: 0,
					};
				}

				scanned_item_map[key].serials.push(...serials);

				scanned_item_map[key].inventory += flt(row.inventory);

				scanned_item_map[key].physical_count += flt(row.physical_count);
			}

			// =====================================================
			// REMOVE DUPLICATE SERIALS
			// =====================================================

			for (let wh in warehouse_scanned) {
				warehouse_scanned[wh] = [...new Set(warehouse_scanned[wh])];
			}

			// =====================================================
			// SERIALIZED ITEMS - MISSING SERIALS
			// =====================================================

			for (let warehouse in warehouse_scanned) {
				show_stock_taking_loader(
					"Create Delivery Note",
					`Checking missing serials from ${warehouse}...`,
				);

				let scanned_serials = warehouse_scanned[warehouse];

				let r = await frappe.call({
					method: "stock_taking.stock_taking.doctype.stock_taking.stock_taking.get_warehouse_serials",
					args: {
						warehouse: warehouse,
					},
				});

				let warehouse_serials = r.message || [];

				let missing_serials = warehouse_serials.filter(
					(s) => !scanned_serials.includes(s.serial_no),
				);

				missing_serials.forEach((d) => {
					delivery_note_items.push({
						item_code: d.item_code,
						warehouse: warehouse,
						serial_no: d.serial_no,
						qty: 1,
					});
				});
			}

			// =====================================================
			// NON-SERIALIZED ITEMS - MISSING STOCK
			// =====================================================

			for (let warehouse in warehouse_scanned) {
				show_stock_taking_loader(
					"Create Delivery Note",
					`Checking missing stock from ${warehouse}...`,
				);

				let r = await frappe.call({
					method: "stock_taking.stock_taking.doctype.stock_taking.stock_taking.get_non_serialized_stock",
					args: {
						warehouse: warehouse,
					},
				});

				let warehouse_items = r.message || [];

				warehouse_items.forEach((stock_item) => {
					let key = `${stock_item.item_code}__${warehouse}`;

					let scanned_qty = 0;

					if (scanned_item_map[key]) {
						scanned_qty = flt(scanned_item_map[key].physical_count);
					}

					let system_qty = flt(stock_item.actual_qty);

					let difference = system_qty - scanned_qty;

					if (difference > 0) {
						delivery_note_items.push({
							item_code: stock_item.item_code,

							warehouse: warehouse,

							serial_no: "",

							qty: difference,
						});
					}
				});
			}

			// =====================================================
			// EXTRA STOCK
			// =====================================================

			for (let key in scanned_item_map) {
				let data = scanned_item_map[key];

				show_stock_taking_loader(
					"Create Delivery Note",
					`Checking extra stock for ${data.item_code}...`,
				);

				// =================================================
				// SERIALIZED ITEM
				// =================================================

				if (data.serials.length > 0) {
					let r = await frappe.call({
						method: "stock_taking.stock_taking.doctype.stock_taking.stock_taking.get_system_serials",

						args: {
							item_code: data.item_code,

							warehouse: data.warehouse,
						},
					});

					let system_serials = (r.message || []).map((s) => String(s).trim());

					let extra = data.serials.filter((s) => !system_serials.includes(s));

					if (extra.length > 0) {
						receipt_items.push({
							item_code: data.item_code,

							warehouse: data.warehouse,

							serial_no: extra.join("\n"),

							qty: extra.length,
						});
					}
				}

				// =================================================
				// NON-SERIALIZED ITEM
				// =================================================
				else {
					let r = await frappe.call({
						method: "stock_taking.stock_taking.doctype.stock_taking.stock_taking.get_non_serialized_stock",

						args: {
							warehouse: data.warehouse,
						},
					});

					let warehouse_items = r.message || [];

					let system_qty = 0;

					let stock_row = warehouse_items.find((d) => d.item_code === data.item_code);

					if (stock_row) {
						system_qty = flt(stock_row.actual_qty);
					}

					let physical_qty = flt(data.physical_count);

					let extra_qty = physical_qty - system_qty;

					if (extra_qty > 0) {
						receipt_items.push({
							item_code: data.item_code,

							warehouse: data.warehouse,

							serial_no: "",

							qty: extra_qty,
						});
					}
				}
			}

			// =====================================================
			// CREATE DELIVERY NOTE
			// =====================================================

			if (delivery_note_items.length > 0) {
				show_stock_taking_loader("Create Delivery Note", "Creating Delivery Note...");

				await create_delivery_note(frm, delivery_note_items);
			}

			// =====================================================
			// CREATE DELIVERY NOTE RETURN
			// =====================================================

			if (receipt_items.length > 0) {
				show_stock_taking_loader(
					"Create Delivery Note Return",
					"Creating Delivery Note Return...",
				);

				await create_delivery_note_return(frm, receipt_items);
			}

			// =====================================================
			// RELOAD
			// =====================================================

			show_stock_taking_loader("Submit Stock Taking", "Finalizing Stock Taking...");

			frappe.validated = true;
		} catch (err) {
			console.error("Stock Taking Submit Error:", err);
			frappe.validated = false;
			let error_message = "Stock Taking Entry Error";
			if (err?.message) {
				error_message += ": " + err.message;
			} else if (err?.responseJSON?.exception) {
				error_message += ": " + err.responseJSON.exception;
			} else {
				error_message += ": " + JSON.stringify(err);
			}
			frappe.throw(error_message);
		} finally {
			hide_stock_taking_loader();
			frm.__stock_taking_submit_in_progress = false;
			frm.enable_save();
		}
	},
});

// =========================================================
// STOCK TAKING CENTER LOADER
// =========================================================

function show_stock_taking_loader(title, message) {
	let loader = document.getElementById("stock-taking-submit-loader");

	// Create loader only once
	if (!loader) {
		loader = document.createElement("div");

		loader.id = "stock-taking-submit-loader";

		loader.innerHTML = `

            <div class="stock-taking-loader-box">

                <div class="stock-taking-spinner"></div>

                <div class="stock-taking-loader-title">
                    ${title}
                </div>

                <div class="stock-taking-loader-message">
                    ${message}
                </div>

            </div>

        `;

		document.body.appendChild(loader);

		// =================================================
		// LOADER CSS
		// =================================================

		const style = document.createElement("style");

		style.id = "stock-taking-loader-style";

		style.innerHTML = `

            #stock-taking-submit-loader {

                position: fixed;

                top: 0;
                left: 0;

                width: 100vw;
                height: 100vh;

                background: rgba(255, 255, 255, 0.75);

                z-index: 999999;

                display: flex;

                align-items: center;
                justify-content: center;

                cursor: wait;

            }

            .stock-taking-loader-box {

                background: #ffffff;

                padding: 35px 55px;

                border-radius: 12px;

                text-align: center;

                min-width: 360px;

                box-shadow:
                    0 10px 40px rgba(0,0,0,0.20);

            }

            .stock-taking-spinner {

                width: 45px;
                height: 45px;

                margin: 0 auto 20px auto;

                border: 4px solid #e5e7eb;

                border-top: 4px solid #2490ef;

                border-radius: 50%;

                animation:
                    stockTakingSpin 0.8s linear infinite;

            }

            .stock-taking-loader-title {

                font-size: 18px;

                font-weight: 600;

                margin-bottom: 8px;

                color: #1f2937;

            }

            .stock-taking-loader-message {

                font-size: 14px;

                color: #6b7280;

            }

            @keyframes stockTakingSpin {

                from {
                    transform: rotate(0deg);
                }

                to {
                    transform: rotate(360deg);
                }

            }

        `;

		document.head.appendChild(style);
	}

	// Update title/message
	let title_element = loader.querySelector(".stock-taking-loader-title");

	let message_element = loader.querySelector(".stock-taking-loader-message");

	if (title_element) {
		title_element.textContent = title;
	}

	if (message_element) {
		message_element.textContent = message;
	}

	loader.style.display = "flex";

	// =====================================================
	// BLOCK SCROLL
	// =====================================================

	document.body.style.overflow = "hidden";
}

// =========================================================
// HIDE STOCK TAKING LOADER
// =========================================================

function hide_stock_taking_loader() {
	let loader = document.getElementById("stock-taking-submit-loader");

	if (loader) {
		loader.style.display = "none";
	}

	document.body.style.overflow = "";
}

// =============================================================
// CREATE DELIVERY NOTE
// =============================================================

async function create_delivery_note(frm, items) {
	// =====================================================
	// GET STOCK TAKING WAREHOUSE
	// =====================================================

	let stock_taking_warehouse = frm.doc.warehouse;

	let warehouses = [];

	if (Array.isArray(stock_taking_warehouse)) {
		warehouses = stock_taking_warehouse.map((row) => row.warehuose).filter(Boolean);
	} else if (typeof stock_taking_warehouse === "string") {
		warehouses = stock_taking_warehouse
			.split("\n")
			.map((w) => w.trim())
			.filter(Boolean);
	}

	// =====================================================
	// FALLBACK
	// =====================================================

	if (!warehouses.length && Array.isArray(frm.doc.items)) {
		warehouses = frm.doc.items.map((row) => row.warehouse).filter(Boolean);
	}

	// =====================================================
	// VALIDATE WAREHOUSE
	// =====================================================

	if (!warehouses.length) {
		frappe.throw("Please select at least one Warehouse in Stock Taking.");
	}

	// =====================================================
	// FIRST WAREHOUSE
	// =====================================================

	let set_warehouse = warehouses[0];

	// =====================================================
	// GROUP ITEMS
	// =====================================================

	let grouped = {};

	for (let row of items) {
		let key = `${row.item_code}__${row.warehouse}`;

		if (!grouped[key]) {
			grouped[key] = {
				item_code: row.item_code,

				warehouse: row.warehouse,

				qty: 0,

				serials: [],
			};
		}

		grouped[key].qty += flt(row.qty);

		// =================================================
		// SERIALS
		// =================================================

		if (row.serial_no) {
			let serials = String(row.serial_no)
				.split("\n")
				.map((s) => s.trim())
				.filter(Boolean);

			grouped[key].serials.push(...serials);
		}
	}

	// =====================================================
	// BUILD DELIVERY NOTE ITEMS
	// =====================================================

	let dn_items = [];

	for (let key in grouped) {
		let row = grouped[key];

		dn_items.push({
			item_code: row.item_code,

			qty: row.qty,

			warehouse: row.warehouse,

			serial_no: [...new Set(row.serials)].join("\n"),
		});
	}

	// =====================================================
	// NO ITEMS
	// =====================================================

	if (!dn_items.length) {
		return;
	}

	// =====================================================
	// DELIVERY NOTE
	//
	// CUSTOMER IS NOT FETCHED HERE.
	//
	// Backend will fetch Customer from:
	//
	// Stock Taking Settings
	//      ->
	// Stock Taking Customer
	//
	// based on Company.
	// =====================================================

	let dn_doc = {
		doctype: "Delivery Note",

		company: frm.doc.company,

		set_warehouse: set_warehouse,

		custom_stock_taking: frm.doc.name,

		items: dn_items,
	};

	console.log("Delivery Note Data:", dn_doc);

	// =====================================================
	// CREATE DELIVERY NOTE
	// =====================================================

	let response = await frappe.call({
		method: "stock_taking.stock_taking.doctype.stock_taking.stock_taking.create_delivery_note",

		args: {
			doc: dn_doc,
		},
	});

	// =====================================================
	// SUCCESS
	// =====================================================

	if (response.message) {
		frappe.show_alert({
			message: `Delivery Note ${response.message.name} created successfully`,

			indicator: "green",
		});
	}
}

async function create_delivery_note_return(frm, items) {
	console.log("Creating Delivery Note Return...");
	console.log("Return Items:", items);

	if (!items || !items.length) {
		return;
	}

	// =====================================================
	// GET WAREHOUSE FROM STOCK TAKING WAREHOUSE CHILD TABLE
	// =====================================================

	let warehouses = [];

	if (frm.doc.warehouse && frm.doc.warehouse.length) {
		warehouses = frm.doc.warehouse.map((row) => row.warehuose).filter(Boolean);
	}

	// FALLBACK FROM STOCK TAKING ITEMS
	if (!warehouses.length) {
		warehouses = (frm.doc.items || []).map((row) => row.warehouse).filter(Boolean);
	}

	warehouses = [...new Set(warehouses)];

	if (!warehouses.length) {
		frappe.throw(__("Warehouse is required to create Delivery Note Return."));
	}

	// =====================================================
	// GROUP ITEMS BY ITEM + WAREHOUSE
	// =====================================================

	let grouped_items = {};

	items.forEach((row) => {
		if (!row.item_code) {
			return;
		}

		let warehouse = row.warehouse || warehouses[0];

		let key = `${row.item_code}__${warehouse}`;

		if (!grouped_items[key]) {
			grouped_items[key] = {
				item_code: row.item_code,
				warehouse: warehouse,
				qty: 0,
				serial_no: [],
			};
		}

		grouped_items[key].qty += flt(row.qty);

		// =================================================
		// SERIAL NUMBERS
		// =================================================

		if (row.serial_no) {
			let serials = String(row.serial_no)
				.split("\n")
				.map((s) => s.trim())
				.filter(Boolean);

			grouped_items[key].serial_no.push(...serials);
		}
	});

	// =====================================================
	// BUILD DELIVERY NOTE ITEMS
	// =====================================================

	let dn_items = [];

	Object.values(grouped_items).forEach((row) => {
		let item = {
			item_code: row.item_code,
			qty: row.qty,
			warehouse: row.warehouse,
		};

		if (row.serial_no.length) {
			item.serial_no = [...new Set(row.serial_no)].join("\n");
		}

		dn_items.push(item);
	});

	if (!dn_items.length) {
		return;
	}

	// =====================================================
	// DEFAULT WAREHOUSE
	// =====================================================

	let set_warehouse = warehouses[0];

	// =====================================================
	// DELIVERY NOTE RETURN DATA
	// =====================================================

	let dn_doc = {
		doctype: "Delivery Note",

		// IMPORTANT
		is_return: 1,

		company: frm.doc.company,

		set_warehouse: set_warehouse,

		custom_stock_taking: frm.doc.name,

		items: dn_items,
	};

	console.log("Delivery Note Return Data:", dn_doc);

	// =====================================================
	// CREATE RETURN DELIVERY NOTE
	// =====================================================

	let r = await frappe.call({
		method: "stock_taking.stock_taking.doctype.stock_taking.stock_taking.create_delivery_note_return",

		args: {
			doc: JSON.stringify(dn_doc),
		},

		freeze: true,

		freeze_message: __("Creating Delivery Note Return..."),
	});

	console.log("Delivery Note Return Response:", r);

	if (!r.message) {
		frappe.throw(__("Failed to create Delivery Note Return."));
	}

	// frappe.msgprint({
	//     title: __("Delivery Note Return Created"),
	//     message: __(
	//         "Delivery Note Return <b>{0}</b> has been created in Draft."
	//     ).replace(
	//         "{0}",
	//         r.message.name
	//     ),
	//     indicator: "green"
	// });
}

// =============================================================
// CREATE MATERIAL RECEIPT
//
// MATERIAL ISSUE CODE REMOVED.
// ONLY MATERIAL RECEIPT REMAINS.
// =============================================================

// async function create_stock_entry(
//     frm,
//     purpose,
//     items
// ) {
//     // =========================================================
//     // ONLY MATERIAL RECEIPT IS ALLOWED
//     // =========================================================

//     if (purpose !== "Material Receipt") {
//         frappe.throw(
//             `Invalid Stock Entry Purpose: ${purpose}`
//         );
//     }

//     // =========================================================
//     // GET DEFAULT WAREHOUSE
//     // =========================================================

//     let default_warehouse = null;

//     if (
//         Array.isArray(frm.doc.warehouse) &&
//         frm.doc.warehouse.length
//     ) {
//         default_warehouse =
//             frm.doc.warehouse[0].warehuose || null;
//     }

//     // Fallback from first Stock Taking Item
//     if (
//         !default_warehouse &&
//         Array.isArray(frm.doc.items) &&
//         frm.doc.items.length
//     ) {
//         default_warehouse =
//             frm.doc.items[0].warehouse || null;
//     }

//     if (!default_warehouse) {
//         frappe.throw(
//             "Warehouse is missing in Stock Taking."
//         );
//     }

//     console.log(
//         "Default Material Receipt Warehouse:",
//         default_warehouse
//     );

//     // =========================================================
//     // STOCK ENTRY DOCUMENT
//     // =========================================================

//     let doc = {
//         doctype: "Stock Entry",

//         stock_entry_type:
//             "Material Receipt",

//         company:
//             frm.doc.company,

//         custom_stock_taking:
//             frm.doc.name,

//         custom_stock_entry_status:
//             "Material Adjustment Receipt",

//         custom_to_company:
//             "",

//         posting_date:
//             frappe.datetime.now_date(),

//         posting_time:
//             frappe.datetime.now_time(),

//         items: []
//     };

//     // =========================================================
//     // MERGE SAME ITEM + WAREHOUSE
//     // =========================================================

//     let grouped = {};

//     items.forEach(d => {

//         // -----------------------------------------------------
//         // GET ACTUAL WAREHOUSE
//         // -----------------------------------------------------

//         let warehouse = null;

//         if (typeof d.warehouse === "string") {
//             warehouse = d.warehouse.trim();
//         }

//         // In case warehouse comes as object
//         else if (
//             d.warehouse &&
//             typeof d.warehouse === "object"
//         ) {
//             warehouse =
//                 d.warehouse.warehouse ||
//                 d.warehouse.warehuose ||
//                 "";
//         }

//         // Final fallback
//         if (!warehouse) {
//             warehouse = default_warehouse;
//         }

//         if (!warehouse) {
//             frappe.throw(
//                 `Warehouse missing for Item ${d.item_code}`
//             );
//         }

//         // -----------------------------------------------------
//         // ITEM CODE VALIDATION
//         // -----------------------------------------------------

//         if (!d.item_code) {
//             frappe.throw(
//                 "Item Code is missing while creating Material Receipt."
//             );
//         }

//         // -----------------------------------------------------
//         // GROUP KEY
//         // -----------------------------------------------------

//         let key =
//             `${d.item_code}__${warehouse}`;

//         // -----------------------------------------------------
//         // SERIAL NUMBERS
//         // -----------------------------------------------------

//         let serials = [];

//         if (d.serial_no) {

//             serials = [
//                 ...new Set(
//                     String(d.serial_no)
//                         .split("\n")
//                         .map(s => s.trim())
//                         .filter(Boolean)
//                 )
//             ];
//         }

//         // -----------------------------------------------------
//         // CREATE GROUP
//         // -----------------------------------------------------

//         if (!grouped[key]) {

//             grouped[key] = {

//                 item_code:
//                     d.item_code,

//                 warehouse:
//                     warehouse,

//                 serials: [],

//                 qty: 0,

//                 stock_taking_item:
//                     d.stock_taking_item,

//                 basic_rate:
//                     flt(d.basic_rate || d.rate || 0)
//             };
//         }

//         // -----------------------------------------------------
//         // MERGE SERIALS
//         // -----------------------------------------------------

//         if (serials.length > 0) {

//             grouped[key].serials.push(
//                 ...serials
//             );

//             grouped[key].serials = [
//                 ...new Set(
//                     grouped[key].serials
//                 )
//             ];

//             grouped[key].qty =
//                 grouped[key].serials.length;
//         }

//         // -----------------------------------------------------
//         // NON SERIALIZED
//         // -----------------------------------------------------

//         else {

//             grouped[key].qty +=
//                 flt(d.qty || 0);
//         }
//     });

//     // =========================================================
//     // FINAL STOCK ENTRY ITEMS
//     // =========================================================

//     Object.values(grouped).forEach(d => {

//         if (!d.warehouse) {
//             frappe.throw(
//                 `Target Warehouse missing for Item ${d.item_code}`
//             );
//         }

//         if (flt(d.qty) <= 0) {
//             return;
//         }

//         let row = {

//             item_code:
//                 d.item_code,

//             qty:
//                 d.qty,

//             serial_no:
//                 d.serials.length
//                     ? d.serials.join("\n")
//                     : "",

//             // IMPORTANT:
//             // Material Receipt uses Target Warehouse
//             t_warehouse:
//                 d.warehouse,

//             custom_stock_taking:
//                 frm.doc.name,

//             custom_stock_taking_item:
//                 d.stock_taking_item
//         };

//         // -----------------------------------------------------
//         // RATE
//         // -----------------------------------------------------

//         if (flt(d.basic_rate) > 0) {

//             row.rate =
//                 d.basic_rate;

//             row.basic_rate =
//                 d.basic_rate;
//         }

//         doc.items.push(row);
//     });

//     // =========================================================
//     // VALIDATION
//     // =========================================================

//     if (!doc.items.length) {
//         frappe.throw(
//             "No valid items found for Material Receipt."
//         );
//     }

//     // =========================================================
//     // DEBUG
//     // =========================================================

//     console.log(
//         "FINAL MATERIAL RECEIPT:",
//         JSON.stringify(doc, null, 2)
//     );

//     // Extra warehouse check
//     doc.items.forEach((row, index) => {

//         console.log(
//             `Material Receipt Row ${index + 1}:`,
//             {
//                 item_code: row.item_code,
//                 qty: row.qty,
//                 t_warehouse: row.t_warehouse,
//                 serial_no: row.serial_no
//             }
//         );

//         if (!row.t_warehouse) {
//             frappe.throw(
//                 `Row ${index + 1}: Target Warehouse is missing for ${row.item_code}`
//             );
//         }
//     });

//     // =========================================================
//     // CREATE STOCK ENTRY
//     // =========================================================

//     let res = await frappe.call({

//         method:
//             "stock_taking.stock_taking.doctype.stock_taking.stock_taking.create_stock_entry",

//         args: {
//             doc: doc
//         },

//         freeze: true,

//         freeze_message:
//             __("Creating Stock Entry...")
//     });

//     // =========================================================
//     // SYNC
//     // =========================================================

//     if (res.message?.name) {

//         await frappe.model.sync(
//             res.message
//         );
//     }

//     // =========================================================
//     // ACTIVATE SERIALS
//     // =========================================================

//     if (purpose === "Material Receipt") {

//         let all_serials = [];

//         Object.values(grouped).forEach(
//             d => {

//                 if (
//                     d.serials &&
//                     d.serials.length > 0
//                 ) {

//                     all_serials.push(
//                         ...d.serials
//                     );
//                 }
//             }
//         );

//         all_serials = [
//             ...new Set(all_serials)
//         ];

//         if (all_serials.length > 0) {

//             await frappe.call({

//                 method:
//                     "stock_taking.stock_taking.doctype.stock_taking.stock_taking.make_serial_active",

//                 args: {
//                     serials:
//                         all_serials
//                 }
//             });
//         }
//     }

//     return res.message;
// }

function calculate_differences(frm) {
	let changed = false;

	(frm.doc.items || []).forEach((row) => {
		// Agar ye dusre warehouse ka item tha
		// to difference hamesha 0 hi rahega
		if (row.is_diff_warehouse_row) {
			if (row.difference !== 0) {
				row.difference = 0;
				changed = true;
			}

			return;
		}

		const inventory = flt(row.inventory) || 0;
		const physical = flt(row.physical_count) || 0;

		const diff = physical - inventory;

		if (row.difference !== diff) {
			row.difference = diff;
			changed = true;
		}
	});

	if (changed) {
		frm.refresh_field("items");
	}
}
function update_child_warehouse(frm) {
	if (!frm.doc.warehouse || !frm.doc.warehouse.length) return;

	const parent_warehouse = frm.doc.warehouse[0].warehuose;

	frm.doc.items.forEach((row) => {
		if (row.warehouse && row.warehouse !== parent_warehouse) {
			row.is_diff_warehouse_row = 1;
			row.warehouse = parent_warehouse;
		}

		// Same warehouse hone par kuch mat karo.
		// Agar pehle se 1 hai to 1 hi rahega.
	});

	frm.refresh_field("items");

	// Warehouse update hone ke baad
	calculate_differences(frm);
}

// Warehouse filter helpers
function get_warehouse_filter(frm) {
	const company = frm.doc.company;
	const stock_selection = frm.doc.stock_selection;

	if (!company) return { filters: { name: ["is", "set_to_null"] } };

	let filters = { company: company };

	if (stock_selection === "Warehouse Selection") {
		filters.is_group = 1;
		filters.parent_warehouse = ["in", ["", null]];
	} else if (stock_selection === "Zone Selection") {
		filters.is_group = 0;
		filters.parent_warehouse = ["!=", ""];
	} else if (stock_selection === "Bin Selection") {
		filters.is_group = 0;
	}

	return { filters: filters };
}

function apply_warehouse_filter(frm) {
	const query = () => get_warehouse_filter(frm);

	if (frm.fields_dict["warehouse"]) {
		frm.set_query("warehouse", query);
	}

	if (frm.fields_dict["items"]) {
		const grid = frm.fields_dict["items"].grid;
		["warehouse", "s_warehouse", "t_warehouse"].forEach((fieldname) => {
			if (grid.get_field(fieldname)) {
				grid.get_field(fieldname).get_query = query;
			}
		});
		grid.refresh();
	}
}

function handle_serial_scan(frm, serial) {
	// =========================================
	// ✅ ACTIVE / DELIVERED IDENTIFY
	// =========================================
	let is_active = serial.status === "Active";

	if (!is_active) {
		frappe.msgprint("Serial was not Active, will be corrected on submit");
	}

	// =========================================
	// ✅ PARENT MULTISELECT WAREHOUSE
	// =========================================
	let parent_warehouse = "";

	if (Array.isArray(frm.doc.warehouse) && frm.doc.warehouse.length) {
		parent_warehouse =
			frm.doc.warehouse[0].warehouse ||
			frm.doc.warehouse[0].warehuose ||
			frm.doc.warehouse[0];
	}

	// =========================================
	// ✅ ACTIVE → SERIAL WAREHOUSE
	// ✅ DELIVERED → PARENT WAREHOUSE
	// =========================================
	let warehouse = is_active ? serial.warehouse || parent_warehouse : parent_warehouse;

	// =========================================
	// ✅ IMPORTANT FIX
	// ACTIVE + DELIVERED SHOULD BE SEPARATE ROW
	// =========================================
	let row = frm.doc.items.find(
		(d) =>
			d.item_code === serial.item_code &&
			d.warehouse === warehouse &&
			// ACTIVE SERIAL ROW
			((is_active && !d.is_delivered_row) ||
				// DELIVERED SERIAL ROW
				(!is_active && d.is_delivered_row)),
	);

	// =========================================
	// ✅ CREATE NEW ROW
	// =========================================
	if (!row) {
		row = frm.add_child("items");

		row.item_code = serial.item_code;
		row.warehouse = warehouse;

		row.serial_no = "";
		row.physical_count = 0;

		// 🔥 CUSTOM FLAG
		row.is_delivered_row = is_active ? 0 : 1;
	}

	// =========================================
	// 🔥 GET ACTIVE SYSTEM SERIALS
	// =========================================
	frappe
		.call({
			method: "stock_taking.stock_taking.doctype.stock_taking.stock_taking.get_system_serials",
			args: {
				item_code: serial.item_code,
				warehouse: warehouse,
			},
		})
		.then((r) => {
			let system_serials = r.message || [];

			// =========================================
			// ✅ INVENTORY ONLY FOR ACTIVE ROW
			// =========================================
			if (is_active) {
				row.inventory = system_serials.length;
			} else {
				// delivered row inventory = 0
				row.inventory = 0;
			}

			// =========================================
			// ✅ EXISTING SERIALS
			// =========================================
			let existing = row.serial_no
				? row.serial_no
						.split("\n")
						.map((s) => s.trim())
						.filter(Boolean)
				: [];

			// =========================================
			//PREVENT DUPLICATE
			// =========================================
			if (!existing.includes(serial.name)) {
				existing.push(serial.name);
			}

			// =========================================
			// ✅ UPDATE ROW
			// =========================================
			row.serial_no = existing.join("\n");

			row.physical_count = existing.length;

			frm.refresh_field("items");

			//UPDATE TOTAL QTY
			update_total_quantity(frm);
		});
}
function process_scan(frm, scanned_code) {
	// =====================================
	// ❌ STOCK LOCATION TYPE REQUIRED
	// =====================================
	if (!frm.doc.stock_selection) {
		frappe.msgprint({
			title: __("Mandatory"),
			message: __("Please select Stock Location Type first"),
			indicator: "red",
		});

		return;
	}

	// =====================================
	// ❌ WAREHOUSE REQUIRED
	// =====================================
	if (!frm.doc.warehouse || frm.doc.warehouse.length === 0) {
		frappe.msgprint({
			title: __("Mandatory"),
			message: __("Please select Warehouse first"),
			indicator: "red",
		});

		return;
	}

	// =====================================
	// ❌ EMPTY SCAN
	// =====================================
	if (!scanned_code) return;

	let warehouse_list = [];

	// =====================================
	// ✅ MULTISELECT WAREHOUSE
	// =====================================
	if (frm.doc.warehouse?.length) {
		warehouse_list = frm.doc.warehouse
			.map((w) => w.warehouse || w.warehuose || w)
			.filter(Boolean);
	}

	// =====================================
	// 🔥 SCAN API
	// =====================================
	frappe
		.call({
			method: "stock_taking.stock_taking.doctype.stock_taking.stock_taking.scan_barcode",
			args: {
				code: scanned_code,
				warehouses: warehouse_list,
			},
		})
		.then((r) => {
			const res = r.message;

			if (!res || !res.success) {
				frappe.msgprint(res?.message || "Invalid barcode");

				return;
			}

			// =====================================
			// ✅ SERIAL SCAN
			// =====================================
			if (res.type === "serial") {
				handle_serial_scan(frm, res.result);
			}

			// =====================================
			// ✅ ITEM SCAN
			// =====================================
			else if (res.type === "item") {
				res.result.forEach((bin) => {
					let row = frm.doc.items.find(
						(d) => d.item_code === bin.item_code && d.warehouse === bin.warehouse,
					);

					// =====================================
					// ✅ CREATE NEW ROW
					// =====================================
					if (!row) {
						row = frm.add_child("items");

						row.item_code = bin.item_code;
						row.warehouse = bin.warehouse;

						row.serial_no = "";

						// ✅ SYSTEM STOCK
						row.inventory = bin.actual_qty || 0;

						// ✅ START WITH 0
						row.physical_count = 0;
					}

					// =====================================
					// ✅ EVERY SCAN = +1
					// =====================================
					row.physical_count = (flt(row.physical_count) || 0) + 1;
				});

				frm.refresh_field("items");
				update_total_quantity(frm);
			}
		});
}

// ======================================
// CHILD TABLE EVENTS
// ======================================
frappe.ui.form.on("Stock taking Items", {
	physical_count(frm, cdt, cdn) {
		update_total_quantity(frm);
	},

	items_remove(frm) {
		update_total_quantity(frm);
	},
});

function update_total_quantity(frm) {
	let total = 0;

	(frm.doc.items || []).forEach((row) => {
		total += flt(row.physical_count || 0);
	});

	frm.set_value("total_quantity", total);
}

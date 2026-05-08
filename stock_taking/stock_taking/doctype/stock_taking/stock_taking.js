
// frappe.ui.form.on('Stock Taking', {
//     onload(frm) {
//         console.log("[Stock Taking] onload triggered");
//         apply_warehouse_filter(frm);
//     },

//     refresh(frm) {
//         console.log("[Stock Taking] refresh triggered");
//         apply_warehouse_filter(frm);
//     },

//     company(frm) {
//         console.log("[Stock Taking] company changed →", frm.doc.company);
//         frm.set_value('warehouse', '');
//         frm.clear_table('items');
//         frm.refresh_field('items');
//         apply_warehouse_filter(frm);
//     },

//     stock_selection(frm) {
//         console.log("[Stock Taking] stock_selection changed →", frm.doc.stock_selection);
//         frm.set_value('warehouse', '');
//         frm.clear_table('items');
//         frm.refresh_field('items');
//         apply_warehouse_filter(frm);
//     },

//     warehouse(frm) {
//         console.log("[Stock Taking] warehouse selected →", frm.doc.warehouse);
//         frm.clear_table("items");
//         frm.refresh_field("items");
//     },

//     // ⭐⭐⭐ BARCODE SCAN ⭐⭐⭐
//     scan_barcode(frm) {
//         if (!frm.doc.scan_barcode) return;

//         let scanned_code = frm.doc.scan_barcode;
//         let warehouse_list = [];

//         // MultiSelect Table
//         if (frm.doc.warehouse && frm.doc.warehouse.length > 0) {
//             warehouse_list = frm.doc.warehouse.map(w => w.warehouse || w.warehuose).filter(Boolean);
//         }

//         frappe.call({
//             method: "frappe.client.get_list",
//             args: {
//                 doctype: "Bin",
//                 fields: ["item_code", "warehouse", "actual_qty"],
//                 filters: {
//                     item_code: scanned_code,
//                     warehouse: ["in", warehouse_list]
//                 },
//                 limit: 50
//             },
//             freeze: true,
//             freeze_message: __("Fetching scanned item...")
//         }).then(r => {
//             frm.clear_table("items");

//             (r.message || []).forEach(bin => {
//                 let row = frm.add_child("items");
//                 row.item_code = bin.item_code;
//                 row.warehouse = bin.warehouse;
//                 row.inventory = bin.actual_qty;
//             });

//             frm.refresh_field("items");
//             frm.set_value("scan_barcode", "");
//         });
//     },

//     // ⭐⭐⭐ BEFORE SUBMIT — CREATE STOCK RECONCILIATION ⭐⭐⭐
//     async before_submit(frm) {
//         frappe.validated = false;

//         frappe.confirm(
//             'Do you want to create and submit a Stock Reconciliation for this Stock Taking?',
//             async () => {

//                 calculate_differences(frm);

//                 try {
//                     // Step 1: Create & Submit Stock Reconciliation
//                     let stock_reco = await create_stock_reconciliation(frm);

//                     // ⭐ Save Stock Reconciliation ID in Stock Taking
//                     frm.set_value("stock_reconciliation", stock_reco.name);
//                     await frm.save();

//                     // Step 2: Submit Stock Taking document
//                     await frappe.call({
//                         method: "frappe.client.submit",
//                         args: { doc: frm.doc },
//                         freeze: true,
//                         freeze_message: __("Submitting Stock Taking...")
//                     });

//                     frm.reload_doc();

//                 } catch (err) {
//                     console.error("[Stock Taking] Error during Stock Reconciliation creation:", err);
//                 }
//             },
//             () => {
//                 frappe.validated = true;
//                 frm.save_or_submit();
//             }
//         );
//     }
// });


// // ------------------ CREATE & SUBMIT STOCK RECONCILIATION ------------------
// async function create_stock_reconciliation(frm) {
//     const items = frm.doc.items.map(row => ({
//         item_code: row.item_code,
//         warehouse: row.warehouse,
//         qty: row.physical_count,
//         custom_stock_taking: frm.doc.name,
//         custom_stock_taking_item: row.name
//     }));

//     const doc = {
//         doctype: "Stock Reconciliation",
//         company: frm.doc.company,
//         purpose: "Stock Reconciliation",
//         posting_date: frappe.datetime.now_date(),
//         posting_time: frappe.datetime.now_time(),
//         items: items
//     };

//     console.log("[Stock Taking] Creating Stock Reconciliation:", doc);

//     // Insert document
//     const insert_response = await frappe.call({
//         method: "frappe.client.insert",
//         args: { doc },
//         freeze: true,
//         freeze_message: __("Creating Stock Reconciliation...")
//     });

//     const reconciliation = insert_response.message;

//     // Submit the Stock Reconciliation
//     const submit_response = await frappe.call({
//         method: "frappe.client.submit",
//         args: { doc: reconciliation },
//         freeze: true,
//         freeze_message: __("Submitting Stock Reconciliation...")
//     });

//     console.log("[Stock Taking] Stock Reconciliation submitted:", submit_response.message);
//     return submit_response.message;
// }


// // ------------------ CALCULATE DIFFERENCE ------------------
// function calculate_differences(frm) {
//     console.log("[Stock Taking] Calculating item differences...");
//     let changed = false;

//     frm.doc.items.forEach(row => {
//         const inventory = flt(row.inventory) || 0;
//         const physical = flt(row.physical_count) || 0;
//         const diff = Math.abs(physical - inventory);

//         if (row.difference !== diff) {
//             row.difference = diff;
//             changed = true;
//         }
//     });

//     if (changed) {
//         frm.refresh_field("items");
//     }
// }


// // ------------------ WAREHOUSE FILTER ------------------
// function get_warehouse_filter(frm) {
//     const company = frm.doc.company;
//     const stock_selection = frm.doc.stock_selection;

//     if (!company) return { filters: { name: ['is', 'set_to_null'] } };

//     let filters = { company: company };

//     if (stock_selection === "Warehouse Selection") {
//         filters.is_group = 1;
//         filters.parent_warehouse = ["in", ["", null]];
//     } else if (stock_selection === "Zone Selection") {
//         filters.is_group = 0;
//         filters.parent_warehouse = ["!=", ""];
//     } else if (stock_selection === "Bin Selection") {
//         filters.is_group = 0;
//     }

//     return { filters: filters };
// }

// function apply_warehouse_filter(frm) {
//     const query = () => get_warehouse_filter(frm);

//     if (frm.fields_dict['warehouse']) {
//         frm.set_query('warehouse', query);
//     }

//     if (frm.fields_dict['items']) {
//         const grid = frm.fields_dict['items'].grid;
//         ['warehouse', 's_warehouse', 't_warehouse'].forEach(fieldname => {
//             if (grid.get_field(fieldname)) {
//                 grid.get_field(fieldname).get_query = query;
//             }
//         });
//         grid.refresh();
//     }
// }




frappe.ui.form.on('Stock Taking', {
   onload(frm) {
    apply_warehouse_filter(frm);

    setTimeout(() => {
        let field = frm.fields_dict.scan_barcode;

        if (!field || !field.$input) return;

        // 🔥 remove old events
        field.$input.off("input");

        let scan_timer = null;

        field.$input.on("input", function(e) {

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
    },

    company(frm) {
        console.log("[Stock Taking] company changed →", frm.doc.company);
        frm.set_value('warehouse', '');
        frm.clear_table('items');
        frm.refresh_field('items');
        apply_warehouse_filter(frm);
    },

    stock_selection(frm) {
        console.log("[Stock Taking] stock_selection changed →", frm.doc.stock_selection);
        frm.set_value('warehouse', '');
        // frm.clear_table('items');
        frm.refresh_field('items');
        apply_warehouse_filter(frm);
    },

    warehouse(frm) {
        console.log("[Stock Taking] warehouse selected →", frm.doc.warehouse);
        // frm.clear_table("items");
        frm.refresh_field("items");
    },

    // Calculate differences before saving (keeps UI responsive)
    before_save(frm) {
        calculate_differences(frm);
    },

    // Barcode scan: add rows from Bin for scanned code
    // scan_barcode(frm) {
    //     const scanned_code = frm.doc.scan_barcode;
    //     let warehouse_list = [];

    //     if (frm.doc.warehouse?.length) {
    //         warehouse_list = frm.doc.warehouse
    //             .map(w => w.warehouse || w.warehuose)
    //             .filter(Boolean);
    //     }
        
    //     frappe.call({
    //         method: "stock_taking.stock_taking.doctype.stock_taking.stock_taking.scan_barcode",
    //         args: {
    //             code: scanned_code,
    //             warehouses: warehouse_list
    //         }
    //     }).then(r => {
    //         const res = r.message;

    //         if (!res || !res.success) {
    //             frappe.msgprint(res?.message || __("Invalid barcode"));
    //             return;
    //         }

    //         if (res.type === "serial") {
    //             handle_serial_scan(frm, res.result);
    //         }

    //         else if (res.type === "item") {
    //             res.result.forEach(bin => {

    //                 let row = frm.doc.items.find(d =>
    //                     d.item_code === bin.item_code &&
    //                     d.warehouse === bin.warehouse
    //                 );

    //                 if (!row) {
    //                     row = frm.add_child("items");
    //                     row.item_code = bin.item_code;
    //                     row.warehouse = bin.warehouse;
    //                 }

    //                 // ✅ physical = actual qty
    //                 row.physical_count = bin.actual_qty;
    //                 row.inventory = bin.actual_qty;

    //                 // ✅ serials fill
    //                 if (res.serials) {
    //                     row.serial_no = res.serials.join("\n");
    //                 }
    //             });

    //             frm.refresh_field("items");
    //         }
    //     }).finally(() => {
    //         frm.set_value("scan_barcode", "");
    //     });

    // },
    
    // BEFORE SUBMIT: ensure a DRAFT Stock Reconciliation exists, but DO NOT save here
    // IMPORTANT: do not call frm.save() or frm.save_or_submit() inside this handler
    // async before_submit(frm) {


    //     // Default: block submit until we explicitly validate
    //     frappe.validated = false;

    //     try {
    //         // If reconciliation already linked, allow submit
    //         if (frm.doc.stock_reconciliation) {
    //             frappe.validated = true;
    //             return;
    //         }

    //         // Create draft Stock Reconciliation synchronously (await)
    //         let stock_reco = await create_stock_reconciliation(frm);

    //         // If server returned the created doc, set the link on current doc
    //         if (stock_reco && stock_reco.name) {
    //             // Set the field value locally; do NOT call frm.save() here
    //             frm.set_value("stock_reconciliation", stock_reco.name);

    //             // Allow the submit to continue
    //             frappe.validated = true;
    //         } else {
    //             // If creation failed or no message returned, stop submit with error
    //             frappe.validated = false;
    //             frappe.throw(__("Failed to create Stock Reconciliation. Submit aborted."));
    //         }
    //     } catch (err) {
    //         console.error("[Stock Taking] before_submit error:", err);
    //         frappe.validated = false;
    //         frappe.throw(__("Error creating Stock Reconciliation: ") + (err.message || err));
    //     }
    // }

    //new
async before_submit(frm) {

    frappe.validated = false;

    try {

        let issue_items = [];
        let receipt_items = [];

        for (let row of (frm.doc.items || [])) {

            // ===============================
            // ✅ CLEAN SCANNED SERIALS
            // ===============================
            let scanned_serials = row.serial_no
                ? [...new Set(
                    row.serial_no
                        .split("\n")
                        .map(s => s.trim())
                        .filter(Boolean)
                )]
                : [];

            // ❗ warehouse validation
            if (!row.warehouse) {
                frappe.throw(`Warehouse missing for item ${row.item_code}`);
            }

            // ===============================
            // 🔥 GET SYSTEM SERIALS (ACTIVE ONLY)
            // ===============================
            let r = await frappe.call({
                method: "stock_taking.stock_taking.doctype.stock_taking.stock_taking.get_system_serials",
                args: {
                    item_code: row.item_code,
                    warehouse: row.warehouse
                }
            });

            let system_serials = (r.message || []).map(s => s.trim());

            // ===============================
            // 🔻 SHORTAGE → Material Issue
            // ===============================
            let missing = system_serials.filter(s => !scanned_serials.includes(s));

            if (missing.length > 0) {
                issue_items.push({
                    item_code: row.item_code,
                    warehouse: row.warehouse,
                    serial_no: missing.join("\n"),
                    qty: missing.length,
                    stock_taking_item: row.name
                });
            }

            // ===============================
            // 🔺 EXCESS → Material Receipt
            // ===============================
            let extra = scanned_serials.filter(s => !system_serials.includes(s));

            if (extra.length > 0) {
                receipt_items.push({
                    item_code: row.item_code,
                    warehouse: row.warehouse,
                    serial_no: extra.join("\n"),
                    qty: extra.length,
                    stock_taking_item: row.name
                });
            }

            // ===============================
            // 🔍 DEBUG (optional but helpful)
            // ===============================
            console.log("Item:", row.item_code);
            console.log("System:", system_serials);
            console.log("Scanned:", scanned_serials);
            console.log("Missing:", missing);
            console.log("Extra:", extra);
        }

        // ===============================
        // 🔥 CREATE STOCK ENTRIES
        // ===============================
        if (issue_items.length > 0) {
            console.log("Creating Material Issue:", issue_items);
            await create_stock_entry(frm, "Material Issue", issue_items);
        }

        if (receipt_items.length > 0) {
            console.log("Creating Material Receipt:", receipt_items);
            await create_stock_entry(frm, "Material Receipt", receipt_items);
        }

        // ===============================
        // ✅ ALLOW SUBMIT
        // ===============================
        frappe.validated = true;

    } catch (err) {

        console.error("Stock Entry Error:", err);

        frappe.validated = false;

        frappe.throw("Stock Entry Error: " + (err.message || err));
    }
}
});

async function create_stock_entry(frm, purpose, items) {

    let doc = {
        doctype: "Stock Entry",
        stock_entry_type: purpose,
        company: frm.doc.company,
        posting_date: frappe.datetime.now_date(),
        posting_time: frappe.datetime.now_time(),
        items: []
    };

    items.forEach(d => {

        if (!d.warehouse && !frm.doc.warehouse) {
            frappe.throw(`Warehouse missing for item ${d.item_code}`);
        }

        let row = {
            item_code: d.item_code,
            qty: d.qty,

            // ✅ CLEAN SERIALS
            serial_no: d.serial_no
                ? [...new Set(d.serial_no.split("\n").map(s => s.trim()).filter(Boolean))].join("\n")
                : "",

            custom_stock_taking: frm.doc.name,
            custom_stock_taking_item: d.stock_taking_item
        };

        if (purpose === "Material Issue") {
            row.s_warehouse = d.warehouse || frm.doc.warehouse;
        } else {
            row.t_warehouse = d.warehouse || frm.doc.warehouse;
        }

        doc.items.push(row);
    });

    // 🔥 CREATE ENTRY
    let res = await frappe.call({
        method: "frappe.client.insert",
        args: { doc }
    });

    // 🔥 ACTIVATE SERIAL (ONLY RECEIPT)
    if (purpose === "Material Receipt") {
        for (let d of items) {
            await frappe.call({
                method: "stock_taking.stock_taking.doctype.stock_taking.stock_taking.make_serial_active",
                args: {
                    serials: d.serial_no.split("\n")
                }
            });
        }
    }

    return res.message;
}
// Create a Draft Stock Reconciliation and return the inserted doc (message)
// async function create_stock_reconciliation(frm) {

//     const items = (frm.doc.items || []).map(row => ({
//         item_code: row.item_code,
//         warehouse: row.warehouse,
//         qty: row.physical_count || 0,
//         custom_stock_taking: frm.doc.name,
//         custom_stock_taking_item: row.name,
//         use_serial_batch_fields: 1
//     }));

//     const doc = {
//         doctype: "Stock Reconciliation",
//         company: frm.doc.company,
//         purpose: "Stock Reconciliation",
//         posting_date: frappe.datetime.now_date(),
//         posting_time: frappe.datetime.now_time(),
//         docstatus: 0,   // DRAFT
//         items: items
//     };

//     // Use frappe.call with await and return message
//     const resp = await frappe.call({
//         method: "frappe.client.insert",
//         args: { doc },
//         freeze: true,
//         freeze_message: __("Creating Draft Stock Reconciliation...")
//     });

//     // resp.message should be the created document
//     return resp.message;
// }


function calculate_differences(frm) {
    let changed = false;

    (frm.doc.items || []).forEach(row => {
        const inventory = flt(row.inventory) || 0;
        const physical = flt(row.physical_count) || 0;

        // const diff = Math.abs(physical - inventory);
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



// Warehouse filter helpers
function get_warehouse_filter(frm) {
    const company = frm.doc.company;
    const stock_selection = frm.doc.stock_selection;

    if (!company) return { filters: { name: ['is', 'set_to_null'] } };

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

    if (frm.fields_dict['warehouse']) {
        frm.set_query('warehouse', query);
    }

    if (frm.fields_dict['items']) {
        const grid = frm.fields_dict['items'].grid;
        ['warehouse', 's_warehouse', 't_warehouse'].forEach(fieldname => {
            if (grid.get_field(fieldname)) {
                grid.get_field(fieldname).get_query = query;
            }
        });
        grid.refresh();
    }
}



// function handle_serial_scan(frm, serial) {

//     if (serial.status !== "Active") {
//         frappe.msgprint(__("Serial is not active"));
//         return;
//     }

//     let row = frm.doc.items.find(d =>
//         d.item_code === serial.item_code &&
//         d.warehouse === serial.warehouse
//     );

//     if (!row) {
//         row = frm.add_child("items");
//         row.item_code = serial.item_code;
//         row.warehouse = serial.warehouse;

//         row.inventory = 1;
//         row.physical_count = 0;
//     }

//     row.physical_count = 1;

//     frm.refresh_field("items");
// }


// function handle_serial_scan(frm, serial) {

//     if (serial.status !== "Active") {
//         frappe.msgprint("Serial is not active");
//         return;
//     }

//     let row = frm.doc.items.find(d =>
//         d.item_code === serial.item_code &&
//         d.warehouse === serial.warehouse
//     );

//     if (!row) {
//         row = frm.add_child("items");
//         row.item_code = serial.item_code;
//         row.warehouse = serial.warehouse;
//         row.physical_count = 0;
//         row.inventory = 0;
//         row.serial_no = "";
//     }

//     // 👉 existing serial list
//     let existing = row.serial_no ? row.serial_no.split("\n") : [];

//     // ✅ duplicate check
//     if (!existing.includes(serial.name)) {

//         existing.push(serial.name);

//         // ✅ update serial list
//         row.serial_no = existing.join("\n");

//         // ✅ increment count
//         row.physical_count = existing.length;
//     }

//     frm.refresh_field("items");
// }
function handle_serial_scan(frm, serial) {

    // if (serial.status !== "Active") {
    //     frappe.msgprint("Serial is not active");
    //     return;
    // }
    if (serial.status !== "Active") {
    frappe.msgprint("Serial was not Active, will be corrected on submit");
}

    let warehouse = serial.warehouse || frm.doc.warehouse;

let row = frm.doc.items.find(d =>
    d.item_code === serial.item_code &&
    d.warehouse === warehouse
);

if (!row) {
    row = frm.add_child("items");
    row.item_code = serial.item_code;
    row.warehouse = warehouse;
    row.serial_no = "";
    row.physical_count = 0;
}

    // 🔥 GET SYSTEM SERIAL COUNT (CORRECT SOURCE)
    frappe.call({
        method: "stock_taking.stock_taking.doctype.stock_taking.stock_taking.get_system_serials",
        args: {
            item_code: serial.item_code,
            warehouse: serial.warehouse
        }
    }).then(r => {

        let system_serials = r.message || [];

        // ✅ inventory = total active serials (IMPORTANT FIX)
        row.inventory = system_serials.length;

        // 👉 existing scanned serials
        let existing = row.serial_no ? row.serial_no.split("\n") : [];

        // ✅ add scanned serial if not duplicate
        if (!existing.includes(serial.name)) {
            existing.push(serial.name);
        }

        // ✅ update values
        row.serial_no = existing.join("\n");
        row.physical_count = existing.length;

        frm.refresh_field("items");
    });
}
function process_scan(frm, scanned_code) {

    if (!scanned_code) return;

    let warehouse_list = [];

    if (frm.doc.warehouse?.length) {
        warehouse_list = frm.doc.warehouse
            .map(w => w.warehouse || w.warehuose)
            .filter(Boolean);
    }

    frappe.call({
        method: "stock_taking.stock_taking.doctype.stock_taking.stock_taking.scan_barcode",
        args: {
            code: scanned_code,
            warehouses: warehouse_list
        }
    }).then(r => {

        const res = r.message;

        if (!res || !res.success) {
            frappe.msgprint(res?.message || "Invalid barcode");
            return;
        }

        if (res.type === "serial") {
            handle_serial_scan(frm, res.result);
        }

        // else if (res.type === "item") {
        //     res.result.forEach(bin => {

        //         let row = frm.doc.items.find(d =>
        //             d.item_code === bin.item_code &&
        //             d.warehouse === bin.warehouse
        //         );

        //         if (!row) {
        //             row = frm.add_child("items");
        //             row.item_code = bin.item_code;
        //             row.warehouse = bin.warehouse;
        //         }

        //         row.physical_count = bin.actual_qty;
        //         row.inventory = bin.actual_qty;

        //         // if (res.serials && res.serials.length) {
        //         //     row.serial_no = res.serials.join("\n");
        //         // }
        //         if (res.serials && res.serials.length > 0) {
        //             row.serial_no = res.serials.join("\n");
        //         } else {
        //             row.serial_no = "";  // clear if none
        //         }
        //     });

        //     frm.refresh_field("items");
        // }
        else if (res.type === "item") {
            res.result.forEach(bin => {

                let row = frm.doc.items.find(d =>
                    d.item_code === bin.item_code &&
                    d.warehouse === bin.warehouse
                );

                if (!row) {
                    row = frm.add_child("items");
                    row.item_code = bin.item_code;
                    row.warehouse = bin.warehouse;
                    row.serial_no = ""; // keep empty
                }

                // ✅ only qty set
                row.physical_count = bin.actual_qty;
                row.inventory = bin.actual_qty;

                // ❌ REMOVE SERIAL AUTO FILL COMPLETELY
            });

            frm.refresh_field("items");
        }

    });
}

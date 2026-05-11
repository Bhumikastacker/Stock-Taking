
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
         update_total_quantity(frm);
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

    //item wise serial no physical active/delivered

// async before_submit(frm) {

//     frappe.validated = false;

//     try {

//         let issue_items = [];
//         let receipt_items = [];

//         // =====================================
//         // ✅ GROUP ALL ROWS
//         // =====================================
//         let grouped_rows = {};

//         for (let row of (frm.doc.items || [])) {

//             if (!row.warehouse) {
//                 frappe.throw(`Warehouse missing for item ${row.item_code}`);
//             }

//             let key = `${row.item_code}__${row.warehouse}`;

//             let serials = row.serial_no
//                 ? row.serial_no
//                     .split("\n")
//                     .map(s => s.trim())
//                     .filter(Boolean)
//                 : [];

//             if (!grouped_rows[key]) {

//                 grouped_rows[key] = {
//                     item_code: row.item_code,
//                     warehouse: row.warehouse,
//                     scanned_serials: [],
//                     stock_taking_item: row.name
//                 };
//             }

//             grouped_rows[key].scanned_serials.push(...serials);
//         }

//         // =====================================
//         // ✅ PROCESS GROUPED DATA
//         // =====================================
//         for (let key in grouped_rows) {

//             let data = grouped_rows[key];

//             // remove duplicate
//             let scanned_serials = [
//                 ...new Set(data.scanned_serials)
//             ];

//             // =====================================
//             // 🔥 GET ACTIVE SERIALS
//             // =====================================
//             let r = await frappe.call({
//                 method: "stock_taking.stock_taking.doctype.stock_taking.stock_taking.get_system_serials",
//                 args: {
//                     item_code: data.item_code,
//                     warehouse: data.warehouse
//                 }
//             });

//             let system_serials = (r.message || [])
//                 .map(s => s.trim())
//                 .filter(Boolean);

//             // =====================================
//             // ✅ ACTIVE SERIALS SCANNED
//             // =====================================
//             let scanned_active = scanned_serials.filter(
//                 s => system_serials.includes(s)
//             );

//             // =====================================
//             // 🔻 ACTIVE NOT SCANNED
//             // =====================================
//             let missing = system_serials.filter(
//                 s => !scanned_active.includes(s)
//             );

//             // =====================================
//             // 🔺 DELIVERED/INACTIVE SCANNED
//             // =====================================
//             let extra = scanned_serials.filter(
//                 s => !system_serials.includes(s)
//             );

//             // =====================================
//             // 🔻 MATERIAL ISSUE
//             // =====================================
//             if (missing.length > 0) {

//                 issue_items.push({
//                     item_code: data.item_code,
//                     warehouse: data.warehouse,
//                     serial_no: missing.join("\n"),
//                     qty: missing.length,
//                     stock_taking_item: data.stock_taking_item
//                 });
//             }

//             // =====================================
//             // 🔺 MATERIAL RECEIPT
//             // =====================================
//             if (extra.length > 0) {

//                 receipt_items.push({
//                     item_code: data.item_code,
//                     warehouse: data.warehouse,
//                     serial_no: extra.join("\n"),
//                     qty: extra.length,
//                     stock_taking_item: data.stock_taking_item
//                 });
//             }

//             console.log("=================================");
//             console.log("ITEM:", data.item_code);
//             console.log("SYSTEM:", system_serials.length);
//             console.log("SCANNED:", scanned_serials);
//             console.log("SCANNED ACTIVE:", scanned_active);
//             console.log("MISSING:", missing.length);
//             console.log("EXTRA:", extra.length);
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

  //warehouse wise serial no physical active/delivered
 async before_submit(frm) {

    frappe.validated = false;

    try {

        let issue_items = [];
        let receipt_items = [];

        // =====================================
        // ✅ ALL SCANNED SERIALS (WHOLE WAREHOUSE)
        // =====================================
        let warehouse_scanned = {};

        // =====================================
        // ✅ STORE SCANNED ITEM DATA
        // =====================================
        let scanned_item_map = {};

        for (let row of (frm.doc.items || [])) {

            if (!row.warehouse) {
                frappe.throw(`Warehouse missing for item ${row.item_code}`);
            }

            let warehouse = row.warehouse;

            // =====================================
            // ✅ SERIALS
            // =====================================
            let serials = row.serial_no
                ? row.serial_no
                    .split("\n")
                    .map(s => s.trim())
                    .filter(Boolean)
                : [];

            // =====================================
            // ✅ WAREHOUSE SCANNED SERIALS
            // =====================================
            if (!warehouse_scanned[warehouse]) {
                warehouse_scanned[warehouse] = [];
            }

            warehouse_scanned[warehouse].push(...serials);

            // =====================================
            // ✅ ITEM MAP
            // =====================================
            let key = `${row.item_code}__${warehouse}`;

            if (!scanned_item_map[key]) {

                scanned_item_map[key] = {
                    item_code: row.item_code,
                    warehouse: warehouse,
                    serials: [],
                    inventory: 0,
                    physical_count: 0
                };
            }

            scanned_item_map[key].serials.push(...serials);

            scanned_item_map[key].inventory +=
                flt(row.inventory);

            scanned_item_map[key].physical_count +=
                flt(row.physical_count);
        }

        // =====================================
        // ✅ REMOVE DUPLICATES
        // =====================================
        for (let wh in warehouse_scanned) {

            warehouse_scanned[wh] = [
                ...new Set(warehouse_scanned[wh])
            ];
        }

        // =====================================
        // 🔥 SERIALIZED ITEM ISSUE
        // =====================================
        for (let warehouse in warehouse_scanned) {

            let scanned_serials =
                warehouse_scanned[warehouse];

            let r = await frappe.call({
                method: "stock_taking.stock_taking.doctype.stock_taking.stock_taking.get_warehouse_serials",
                args: {
                    warehouse: warehouse
                }
            });

            let warehouse_serials = r.message || [];

            // =====================================
            // 🔻 NOT SCANNED SERIALS
            // =====================================
            let missing_serials = warehouse_serials.filter(
                s => !scanned_serials.includes(s.serial_no)
            );

            missing_serials.forEach(d => {

                issue_items.push({
                    item_code: d.item_code,
                    warehouse: warehouse,
                    serial_no: d.serial_no,
                    qty: 1
                });
            });
        }

        // =====================================
        // 🔥 NON SERIALIZED ISSUE
        // WHOLE WAREHOUSE
        // =====================================
        for (let warehouse in warehouse_scanned) {

            // =====================================
            // 🔥 GET ALL NON SERIAL ITEMS
            // =====================================
            let r = await frappe.call({
                method: "stock_taking.stock_taking.doctype.stock_taking.stock_taking.get_non_serialized_stock",
                args: {
                    warehouse: warehouse
                }
            });

            let warehouse_items = r.message || [];

            warehouse_items.forEach(stock_item => {

                let key =
                    `${stock_item.item_code}__${warehouse}`;

                // =====================================
                // ✅ SCANNED QTY
                // =====================================
                let scanned_qty = 0;

                if (scanned_item_map[key]) {

                    scanned_qty =
                        flt(scanned_item_map[key].physical_count);
                }

                // =====================================
                // ✅ SYSTEM QTY
                // =====================================
                let system_qty =
                    flt(stock_item.actual_qty);

                // =====================================
                // 🔻 DIFFERENCE
                // =====================================
                let difference =
                    system_qty - scanned_qty;

                if (difference > 0) {

                    issue_items.push({

                        item_code: stock_item.item_code,

                        warehouse: warehouse,

                        serial_no: "",

                        qty: difference
                    });
                }
            });
        }

        // =====================================
        // 🔺 RECEIPT LOGIC
        // =====================================
        for (let key in scanned_item_map) {

            let data = scanned_item_map[key];

            // skip non serial item
            if (data.serials.length === 0) {
                continue;
            }

            let r = await frappe.call({
                method: "stock_taking.stock_taking.doctype.stock_taking.stock_taking.get_system_serials",
                args: {
                    item_code: data.item_code,
                    warehouse: data.warehouse
                }
            });

            let system_serials = (r.message || [])
                .map(s => s.trim());

            // delivered/inactive scanned
            let extra = data.serials.filter(
                s => !system_serials.includes(s)
            );

            if (extra.length > 0) {

                receipt_items.push({
                    item_code: data.item_code,
                    warehouse: data.warehouse,
                    serial_no: extra.join("\n"),
                    qty: extra.length
                });
            }
        }

        // =====================================
        // 🔥 CREATE ISSUE
        // =====================================
        if (issue_items.length > 0) {

            await create_stock_entry(
                frm,
                "Material Issue",
                issue_items
            );
        }

        // =====================================
        // 🔥 CREATE RECEIPT
        // =====================================
        if (receipt_items.length > 0) {

            await create_stock_entry(
                frm,
                "Material Receipt",
                receipt_items
            );
        }

        frappe.validated = true;

    } catch (err) {

        console.error(err);

        frappe.validated = false;

        frappe.throw(
            "Stock Entry Error: " +
            (err.message || err)
        );
    }
}   
});

 //warehouse wise serial no physical active/delivered


  //item wise serial no physical active/delivered

async function create_stock_entry(frm, purpose, items) {

    let doc = {

        doctype: "Stock Entry",

        stock_entry_type: purpose,

        company: frm.doc.company,

        custom_stock_taking: frm.doc.name,

        custom_to_company: "",

        posting_date: frappe.datetime.now_date(),

        posting_time: frappe.datetime.now_time(),

        items: []
    };

    // =====================================
    // 🔥 MERGE SAME ITEM + WAREHOUSE
    // =====================================
    let grouped = {};

    items.forEach(d => {

        let warehouse =
            d.warehouse || frm.doc.warehouse;

        let key =
            `${d.item_code}__${warehouse}`;

        let serials = d.serial_no
            ? [...new Set(
                d.serial_no
                    .split("\n")
                    .map(s => s.trim())
                    .filter(Boolean)
            )]
            : [];

        if (!grouped[key]) {

            grouped[key] = {

                item_code: d.item_code,

                warehouse: warehouse,

                serials: [],

                qty: 0,

                stock_taking_item:
                    d.stock_taking_item
            };
        }

        // =====================================
        // ✅ MERGE SERIALS
        // =====================================
        grouped[key].serials.push(...serials);

        grouped[key].serials = [
            ...new Set(grouped[key].serials)
        ];

        // =====================================
        // ✅ SERIALIZED
        // =====================================
        if (serials.length > 0) {

            grouped[key].qty =
                grouped[key].serials.length;
        }

        // =====================================
        // ✅ NON SERIALIZED
        // =====================================
        else {

            grouped[key].qty +=
                flt(d.qty || 0);
        }
    });

    // =====================================
    // 🔥 FINAL ROWS
    // =====================================
    Object.values(grouped).forEach(d => {

        let row = {

            item_code: d.item_code,

            qty: d.qty,

            serial_no: d.serials.length
                ? d.serials.join("\n")
                : "",

            custom_stock_taking:
                frm.doc.name,

            custom_stock_taking_item:
                d.stock_taking_item
        };

        // =====================================
        // ✅ WAREHOUSE
        // =====================================
        if (purpose === "Material Issue") {

            row.s_warehouse = d.warehouse;
        }

        else {

            row.t_warehouse = d.warehouse;
        }

        doc.items.push(row);
    });

    console.log(
        "FINAL STOCK ENTRY",
        doc
    );

    // =====================================
    // 🔥 CREATE ENTRY
    // =====================================
    let res = await frappe.call({

        method:"stock_taking.stock_taking.doctype.stock_taking.stock_taking.create_stock_entry",

        args: {
            doc: doc
        },
        freeze: true,
        freeze_message: __("Creating Stock Entry...")
    });

    // ✅ IMPORTANT
    if (res.message?.name) {

        await frappe.model.sync(res.message);
    }

    // =====================================
    // 🔥 ACTIVATE SERIALS
    // =====================================
    if (purpose === "Material Receipt") {

        for (let d of Object.values(grouped)) {

            if (d.serials.length > 0) {

                await frappe.call({

                    method:
                        "stock_taking.stock_taking.doctype.stock_taking.stock_taking.make_serial_active",

                    args: {
                        serials: d.serials
                    }
                });
            }
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

    // =========================================
    // ✅ ACTIVE / DELIVERED IDENTIFY
    // =========================================
    let is_active = serial.status === "Active";

    if (!is_active) {
        frappe.msgprint(
            "Serial was not Active, will be corrected on submit"
        );
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
    let warehouse = is_active
        ? (serial.warehouse || parent_warehouse)
        : parent_warehouse;

    // =========================================
    // ✅ IMPORTANT FIX
    // ACTIVE + DELIVERED SHOULD BE SEPARATE ROW
    // =========================================
    let row = frm.doc.items.find(d =>

        d.item_code === serial.item_code &&
        d.warehouse === warehouse &&

        (
            // ACTIVE SERIAL ROW
            (is_active && !d.is_delivered_row)

            ||

            // DELIVERED SERIAL ROW
            (!is_active && d.is_delivered_row)
        )
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
    frappe.call({
        method: "stock_taking.stock_taking.doctype.stock_taking.stock_taking.get_system_serials",
        args: {
            item_code: serial.item_code,
            warehouse: warehouse
        }
    }).then(r => {

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
                .map(s => s.trim())
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
            indicator: "red"
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
            indicator: "red"
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
            .map(w => w.warehouse || w.warehuose || w)
            .filter(Boolean);
    }

    // =====================================
    // 🔥 SCAN API
    // =====================================
    frappe.call({
        method: "stock_taking.stock_taking.doctype.stock_taking.stock_taking.scan_barcode",
        args: {
            code: scanned_code,
            warehouses: warehouse_list
        }
    }).then(r => {

        const res = r.message;

        if (!res || !res.success) {

            frappe.msgprint(
                res?.message || "Invalid barcode"
            );

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

    res.result.forEach(bin => {

        let row = frm.doc.items.find(d =>
            d.item_code === bin.item_code &&
            d.warehouse === bin.warehouse
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
        row.physical_count =
            (flt(row.physical_count) || 0) + 1;
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
    }
});

function update_total_quantity(frm) {

    let total = 0;

    (frm.doc.items || []).forEach(row => {

        total += flt(row.physical_count || 0);
    });

    frm.set_value("total_quantity", total);
}

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
//         if (!frm.doc.warehouse) {
//             console.warn("[Stock Taking] No warehouse selected — skipping Bin fetch");
//             return;
//         }
//         fetch_bin_items(frm);
//     },

//     // === Custom before_submit confirmation and logic ===
//     async before_submit(frm) {
//         frappe.validated = false; // stop default submit
//         frappe.confirm(
//             'Do you want to create and submit a Stock Reconciliation for this Stock Taking?',
//             async () => {
//                 frappe.show_progress('Processing', 10, 100, 'Calculating Differences...');

//                 // ✅ Step 1: Calculate Difference before submission
//                 calculate_differences(frm);

//                 frappe.show_progress('Processing', 30, 100, 'Creating Stock Reconciliation...');

//                 try {
//                     // ✅ Step 2: Create & Auto-Submit the Stock Reconciliation
//                     const reconciliation = await create_stock_reconciliation(frm);

//                     frappe.show_progress('Processing', 70, 100, 'Submitting Stock Taking...');

//                     // ✅ Step 3: Submit the Stock Taking itself
//                     await frappe.call({
//                         method: "frappe.client.submit",
//                         args: { doc: frm.doc },
//                         freeze: true,
//                         freeze_message: __("Submitting Stock Taking...")
//                     });

//                     frappe.show_progress('Processing', 100, 100, 'Done!');
                  

//                     // ✅ Stay on same Stock Taking page (no redirect)
//                     frm.reload_doc();

//                 } catch (err) {
//                     console.error("[Stock Taking] Error during Stock Reconciliation creation:", err);
            
//                 }
//             },
//             () => {
//                 // User pressed No
//                 frappe.validated = true;
//                 frm.save_or_submit();
//             }
//         );
//     }
// });


// // -------- CREATE & SUBMIT STOCK RECONCILIATION --------
// async function create_stock_reconciliation(frm) {
//     // Map each Stock Taking item → Stock Reconciliation item
//     const items = frm.doc.items.map(row => ({
//         item_code: row.item_code,
//         warehouse: row.warehouse,
//         qty: row.physical_count,
//         custom_stock_taking: frm.doc.name,          // Link to Stock Taking doc
//         custom_stock_taking_item: row.name          // Link to Stock Taking Item row
//     }));

//     const doc = {
//         doctype: "Stock Reconciliation",
//         company: frm.doc.company,
//         purpose: "Stock Reconciliation",
//         posting_date: frappe.datetime.now_date(),
//         posting_time: frappe.datetime.now_time(),
//         items: items
//     };

//     console.log("[Stock Taking] Creating and Submitting Stock Reconciliation:", doc);

//     // Step 1: Insert the Stock Reconciliation (Draft)
//     const insert_response = await frappe.call({
//         method: "frappe.client.insert",
//         args: { doc },
//         freeze: true,
//         freeze_message: __("Creating Stock Reconciliation...")
//     });

//     const reconciliation = insert_response.message;

//     // Step 2: Submit the Stock Reconciliation Automatically
//     const submit_response = await frappe.call({
//         method: "frappe.client.submit",
//         args: { doc: reconciliation },
//         freeze: true,
//         freeze_message: __("Submitting Stock Reconciliation...")
//     });

//     console.log("[Stock Taking] Stock Reconciliation submitted:", submit_response.message);
//     return submit_response.message;
// }


// // -------- CALCULATE DIFFERENCE --------
// function calculate_differences(frm) {
//     console.log("[Stock Taking] Calculating item differences...");
//     let changed = false;

//     frm.doc.items.forEach(row => {
//         const inventory = flt(row.inventory) || 0;
//         const physical = flt(row.physical_count) || 0;
//         const diff = Math.abs(physical - inventory); // ✅ Always positive value

//         if (row.difference !== diff) {
//             row.difference = diff;
//             changed = true;
//             console.log(`[Diff Updated] Item: ${row.item_code} | Inv: ${inventory} | Physical: ${physical} | Diff: ${diff}`);
//         }
//     });

//     if (changed) {
//         frm.refresh_field("items");
       
//     }
// }


// // -------- FILTER LOGIC --------
// function get_warehouse_filter(frm) {
//     const company = frm.doc.company;
//     const stock_selection = frm.doc.stock_selection;

//     console.log("[Stock Taking] get_warehouse_filter called with:", { company, stock_selection });

//     if (!company) {
//         console.warn("[Stock Taking] Company not selected — returning null filter");
//         return { filters: { name: ['is', 'set_to_null'] } };
//     }

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

//     console.log("[Stock Taking] Final warehouse filter:", filters);
//     return { filters: filters };
// }


// // -------- APPLY FILTER --------
// function apply_warehouse_filter(frm) {
//     console.log("[Stock Taking] apply_warehouse_filter called");
//     const query = () => get_warehouse_filter(frm);

//     if (frm.fields_dict['warehouse']) {
//         frm.set_query('warehouse', query);
//         console.log("[Stock Taking] Applied warehouse filter on main field");
//     }

//     if (frm.fields_dict['items']) {
//         const grid = frm.fields_dict['items'].grid;
//         ['warehouse', 's_warehouse', 't_warehouse'].forEach(fieldname => {
//             if (grid.get_field(fieldname)) {
//                 grid.get_field(fieldname).get_query = query;
//                 console.log(`[Stock Taking] Applied warehouse filter on child field: ${fieldname}`);
//             }
//         });
//         grid.refresh();
//     }
// }


// // -------- FETCH BIN ITEMS --------
// function fetch_bin_items(frm) {
//     console.log("[Stock Taking] Fetching Bin data for warehouse:", frm.doc.warehouse);

//     frappe.call({
//         method: "frappe.client.get_list",
//         args: {
//             doctype: "Bin",
//             fields: ["item_code", "warehouse", "actual_qty"],
//             filters: { warehouse: frm.doc.warehouse },
//             limit: 500
//         },
//         freeze: true,
//         freeze_message: __("Fetching items from Bin..."),

//         callback: function(r) {
//             console.log("[Stock Taking] Bin fetch response:", r);

//             if (r.message && r.message.length > 0) {
//                 console.log(`[Stock Taking] ${r.message.length} Bin records found`);
//                 frm.clear_table("items");

//                 r.message.forEach(bin => {
//                     let child = frm.add_child("items");
//                     child.item_code = bin.item_code;
//                     child.warehouse = bin.warehouse;
//                     child.inventory = bin.actual_qty;
//                 });

//                 frm.refresh_field("items");
//             } else {
//                 console.warn(`[Stock Taking] No Bin records found for warehouse ${frm.doc.warehouse}`);
//                 frm.clear_table("items");
//                 frm.refresh_field("items");
//             }
//         }
//     });
// }


frappe.ui.form.on('Stock Taking', {
    onload(frm) {
        console.log("[Stock Taking] onload triggered");
        apply_warehouse_filter(frm);
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
        frm.clear_table('items');
        frm.refresh_field('items');
        apply_warehouse_filter(frm);
    },

    warehouse(frm) {
        console.log("[Stock Taking] warehouse selected →", frm.doc.warehouse);
        fetch_bin_items(frm);
    },

    // --- Before Submit: Confirm & Create Stock Reconciliation ---
    async before_submit(frm) {
        frappe.validated = false;

        frappe.confirm(
            'Do you want to create and submit a Stock Reconciliation for this Stock Taking?',
            async () => {
                frappe.show_progress('Processing', 10, 100, 'Calculating Differences...');

                // Step 1: Calculate Differences
                calculate_differences(frm);

                frappe.show_progress('Processing', 30, 100, 'Creating Stock Reconciliation...');

                try {
                    // Step 2: Create & Auto-Submit Stock Reconciliation
                    await create_stock_reconciliation(frm);

                    frappe.show_progress('Processing', 70, 100, 'Submitting Stock Taking...');

                    // Step 3: Submit Stock Taking
                    await frappe.call({
                        method: "frappe.client.submit",
                        args: { doc: frm.doc },
                        freeze: true,
                        freeze_message: __("Submitting Stock Taking...")
                    });

                    frappe.show_progress('Processing', 100, 100, 'Done!');
                    frm.reload_doc();

                } catch (err) {
                    console.error("[Stock Taking] Error during Stock Reconciliation creation:", err);
                }
            },
            () => {
                frappe.validated = true;
                frm.save_or_submit();
            }
        );
    }
});

// ------------------ CREATE & SUBMIT STOCK RECONCILIATION ------------------
async function create_stock_reconciliation(frm) {
    const items = frm.doc.items.map(row => ({
        item_code: row.item_code,
        warehouse: row.warehouse,
        qty: row.physical_count,
        custom_stock_taking: frm.doc.name,
        custom_stock_taking_item: row.name
    }));

    const doc = {
        doctype: "Stock Reconciliation",
        company: frm.doc.company,
        purpose: "Stock Reconciliation",
        posting_date: frappe.datetime.now_date(),
        posting_time: frappe.datetime.now_time(),
        items: items
    };

    console.log("[Stock Taking] Creating Stock Reconciliation:", doc);

    const insert_response = await frappe.call({
        method: "frappe.client.insert",
        args: { doc },
        freeze: true,
        freeze_message: __("Creating Stock Reconciliation...")
    });

    const reconciliation = insert_response.message;

    const submit_response = await frappe.call({
        method: "frappe.client.submit",
        args: { doc: reconciliation },
        freeze: true,
        freeze_message: __("Submitting Stock Reconciliation...")
    });

    console.log("[Stock Taking] Stock Reconciliation submitted:", submit_response.message);
    return submit_response.message;
}

// ------------------ CALCULATE DIFFERENCE ------------------
function calculate_differences(frm) {
    console.log("[Stock Taking] Calculating item differences...");
    let changed = false;

    frm.doc.items.forEach(row => {
        const inventory = flt(row.inventory) || 0;
        const physical = flt(row.physical_count) || 0;
        const diff = Math.abs(physical - inventory);

        if (row.difference !== diff) {
            row.difference = diff;
            changed = true;
            console.log(`[Diff Updated] Item: ${row.item_code} | Inv: ${inventory} | Physical: ${physical} | Diff: ${diff}`);
        }
    });

    if (changed) {
        frm.refresh_field("items");
    }
}

// ------------------ WAREHOUSE FILTER ------------------
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

// ------------------ FETCH BIN ITEMS ------------------
function fetch_bin_items(frm) {
    if (!frm.doc.warehouse || frm.doc.warehouse.length === 0) {
        frm.clear_table("items");
        frm.refresh_field("items");
        return;
    }

    // Extract warehouse names from Table MultiSelect
    let warehouse_list = frm.doc.warehouse.map(w => w.warehuose || w.warehouse).filter(Boolean);

    frappe.call({
        method: "frappe.client.get_list",
        args: {
            doctype: "Bin",
            fields: ["item_code", "warehouse", "actual_qty"],
            filters: { warehouse: ["in", warehouse_list] },
            limit: 500
        },
        freeze: true,
        freeze_message: __("Fetching items from Bin..."),

        callback: function(r) {
            frm.clear_table("items");

            if (r.message && r.message.length > 0) {
                r.message.forEach(bin => {
                    let child = frm.add_child("items");
                    child.item_code = bin.item_code;
                    child.warehouse = bin.warehouse;
                    child.inventory = bin.actual_qty;
                });
            }

            frm.refresh_field("items");
        }
    });
}


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
        frm.clear_table("items");
        frm.refresh_field("items");
    },

    // ⭐⭐⭐ BARCODE SCAN ⭐⭐⭐
    scan_barcode(frm) {
        if (!frm.doc.scan_barcode) return;

        let scanned_code = frm.doc.scan_barcode;
        let warehouse_list = [];

        // MultiSelect Table
        if (frm.doc.warehouse && frm.doc.warehouse.length > 0) {
            warehouse_list = frm.doc.warehouse.map(w => w.warehouse || w.warehuose).filter(Boolean);
        }

        frappe.call({
            method: "frappe.client.get_list",
            args: {
                doctype: "Bin",
                fields: ["item_code", "warehouse", "actual_qty"],
                filters: {
                    item_code: scanned_code,
                    warehouse: ["in", warehouse_list]
                },
                limit: 50
            },
            freeze: true,
            freeze_message: __("Fetching scanned item...")
        }).then(r => {
            frm.clear_table("items");

            (r.message || []).forEach(bin => {
                let row = frm.add_child("items");
                row.item_code = bin.item_code;
                row.warehouse = bin.warehouse;
                row.inventory = bin.actual_qty;
            });

            frm.refresh_field("items");
            frm.set_value("scan_barcode", "");
        });
    },

    // ⭐⭐⭐ BEFORE SUBMIT — CREATE STOCK RECONCILIATION ⭐⭐⭐
    async before_submit(frm) {
        frappe.validated = false;

        frappe.confirm(
            'Do you want to create and submit a Stock Reconciliation for this Stock Taking?',
            async () => {

                calculate_differences(frm);

                try {
                    // Step 1: Create & Submit Stock Reconciliation
                    let stock_reco = await create_stock_reconciliation(frm);

                    // ⭐ Save Stock Reconciliation ID in Stock Taking
                    frm.set_value("stock_reconciliation", stock_reco.name);
                    await frm.save();

                    // Step 2: Submit Stock Taking document
                    await frappe.call({
                        method: "frappe.client.submit",
                        args: { doc: frm.doc },
                        freeze: true,
                        freeze_message: __("Submitting Stock Taking...")
                    });

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

    // Insert document
    const insert_response = await frappe.call({
        method: "frappe.client.insert",
        args: { doc },
        freeze: true,
        freeze_message: __("Creating Stock Reconciliation...")
    });

    const reconciliation = insert_response.message;

    // Submit the Stock Reconciliation
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



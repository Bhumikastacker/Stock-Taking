
frappe.ui.form.on("Stock Taking", {

    // =====================================================
    // ONLOAD
    // =====================================================

    onload(frm) {

        apply_warehouse_filter(frm);

        setTimeout(() => {

            let field =
                frm.fields_dict.scan_barcode;

            if (!field || !field.$input) {
                return;
            }

            field.$input.off("input");

            let scan_timer = null;

            field.$input.on(
                "input",
                function () {

                    let value =
                        field.$input
                            .val()
                            .trim();

                    if (!value) {
                        return;
                    }

                    clearTimeout(
                        scan_timer
                    );

                    scan_timer = setTimeout(
                        () => {

                            process_scan(
                                frm,
                                value
                            );

                            field.$input.val("");
                            field.$input.get(0).value = "";

                            frm.doc.scan_barcode = "";

                            field.$input.focus();

                        },
                        200
                    );
                }
            );

            field.$input.focus();

        }, 500);
    },


    // =====================================================
    // REFRESH
    // =====================================================

    refresh(frm) {

        apply_warehouse_filter(frm);

        update_total_quantity(frm);
    },


    // =====================================================
    // COMPANY
    // =====================================================

    company(frm) {

        frm.set_value(
            "warehouse",
            ""
        );

        frm.clear_table(
            "items"
        );

        frm.refresh_field(
            "items"
        );

        apply_warehouse_filter(frm);
    },


    // =====================================================
    // STOCK SELECTION
    // =====================================================

    stock_selection(frm) {

        frm.set_value(
            "warehouse",
            ""
        );

        frm.refresh_field(
            "items"
        );

        apply_warehouse_filter(frm);
    },


    // =====================================================
    // WAREHOUSE
    // =====================================================

    warehouse(frm) {

        frm.refresh_field(
            "items"
        );
    },


    // =====================================================
    // BEFORE SAVE
    // =====================================================

    before_save(frm) {

        update_child_warehouse(frm);
    },


    // =====================================================
    // BEFORE SUBMIT
    // =====================================================

    async before_submit(frm) {

        // -------------------------------------------------
        // PREVENT DOUBLE SUBMIT
        // -------------------------------------------------

        if (
            frm.__stock_taking_submit_in_progress
        ) {

            frappe.validated = false;

            frappe.msgprint({
                title: __("Please Wait"),
                message: __(
                    "Stock Taking submission is already in progress."
                ),
                indicator: "orange"
            });

            return;
        }

        frm.__stock_taking_submit_in_progress = true;

        frm.disable_save();

        frappe.validated = false;

        show_stock_taking_loader(
            "Stock Taking",
            "Preparing stock data..."
        );

        try {

            // =================================================
            // 1. BUILD SCANNED DATA
            // =================================================

            let warehouse_data = {};

            for (
                let row of (
                    frm.doc.items || []
                )
            ) {

                if (!row.warehouse) {

                    frappe.throw(
                        __(
                            "Warehouse missing for item {0}"
                        ).replace(
                            "{0}",
                            row.item_code
                        )
                    );
                }

                let warehouse =
                    row.warehouse;

                if (
                    !warehouse_data[
                        warehouse
                    ]
                ) {

                    warehouse_data[
                        warehouse
                    ] = {
                        scanned_serials: new Set(),
                        scanned_items: {}
                    };
                }

                // ---------------------------------------------
                // SERIALS
                // ---------------------------------------------

                let serials = row.serial_no
                    ? String(
                        row.serial_no
                    )
                        .split("\n")
                        .map(
                            s => s.trim()
                        )
                        .filter(Boolean)
                    : [];

                serials.forEach(
                    serial => {

                        warehouse_data[
                            warehouse
                        ]
                            .scanned_serials
                            .add(serial);
                    }
                );

                // ---------------------------------------------
                // ITEM DATA
                // ---------------------------------------------

                let item_code =
                    row.item_code;

                if (!item_code) {
                    continue;
                }

                if (
                    !warehouse_data[
                        warehouse
                    ].scanned_items[
                        item_code
                    ]
                ) {

                    warehouse_data[
                        warehouse
                    ].scanned_items[
                        item_code
                    ] = {
                        physical_count: 0,
                        serials: []
                    };
                }

                let item_data =
                    warehouse_data[
                        warehouse
                    ].scanned_items[
                        item_code
                    ];

                item_data.physical_count +=
                    flt(
                        row.physical_count
                    );

                item_data.serials.push(
                    ...serials
                );
            }


            // =================================================
            // 2. REMOVE DUPLICATE SERIALS
            // =================================================

            Object.values(
                warehouse_data
            ).forEach(
                data => {

                    data.scanned_items =
                        Object.fromEntries(
                            Object.entries(
                                data.scanned_items
                            ).map(
                                ([item_code, item]) => {

                                    item.serials =
                                        [
                                            ...new Set(
                                                item.serials
                                            )
                                        ];

                                    return [
                                        item_code,
                                        item
                                    ];
                                }
                            )
                        );
                }
            );


            // =================================================
            // 3. ANALYZE EACH WAREHOUSE
            // =================================================

            let all_issue_items = [];
            let all_receipt_items = [];

            let warehouses =
                Object.keys(
                    warehouse_data
                );

            for (
                let warehouse of warehouses
            ) {

                show_stock_taking_loader(
                    "Stock Taking",
                    `Checking warehouse ${warehouse}...`
                );

                let data =
                    warehouse_data[
                        warehouse
                    ];

                // ---------------------------------------------
                // ONE API CALL ONLY
                // ---------------------------------------------

                let response =
                    await frappe.call({

                        method:
                            "stock_taking.stock_taking.doctype.stock_taking.stock_taking.analyze_stock_taking",

                        args: {

                            warehouse:
                                warehouse,

                            scanned_serials:
                                JSON.stringify(
                                    [
                                        ...data.scanned_serials
                                    ]
                                ),

                            scanned_items:
                                JSON.stringify(
                                    data.scanned_items
                                )
                        }
                    });

                let result =
                    response.message || {};

                if (!result.success) {

                    frappe.throw(
                        __(
                            "Stock analysis failed for warehouse {0}"
                        ).replace(
                            "{0}",
                            warehouse
                        )
                    );
                }

                // ---------------------------------------------
                // ISSUE
                // ---------------------------------------------

                if (
                    result.issue_items &&
                    result.issue_items.length
                ) {

                    all_issue_items.push(
                        ...result.issue_items
                    );
                }

                // ---------------------------------------------
                // RECEIPT
                // ---------------------------------------------

                if (
                    result.receipt_items &&
                    result.receipt_items.length
                ) {

                    all_receipt_items.push(
                        ...result.receipt_items
                    );
                }
            }


            // =================================================
            // 4. CREATE DELIVERY NOTE
            // =================================================

            if (
                all_issue_items.length
            ) {

                show_stock_taking_loader(
                    "Create Delivery Note",
                    `Creating Delivery Note...`
                );

                await create_delivery_note(
                    frm,
                    all_issue_items
                );
            }


            // =================================================
            // 5. CREATE RETURN DELIVERY NOTE
            // =================================================

            if (
                all_receipt_items.length
            ) {

                show_stock_taking_loader(
                    "Create Delivery Note Return",
                    `Creating Return Delivery Note...`
                );

                await create_delivery_note_return(
                    frm,
                    all_receipt_items
                );
            }


            // =================================================
            // 6. FINALIZE
            // =================================================

            show_stock_taking_loader(
                "Submit Stock Taking",
                "Finalizing Stock Taking..."
            );

            frappe.validated = true;

        } catch (err) {

            console.error(
                "Stock Taking Submit Error:",
                err
            );

            frappe.validated = false;

            let error_message =
                "Stock Taking Entry Error";

            if (
                err &&
                err.message
            ) {

                error_message +=
                    ": " +
                    err.message;

            } else if (
                err &&
                err.responseJSON &&
                err.responseJSON.exception
            ) {

                error_message +=
                    ": " +
                    err.responseJSON.exception;

            } else {

                error_message +=
                    ": " +
                    JSON.stringify(err);
            }

            frappe.throw(
                error_message
            );

        } finally {

            hide_stock_taking_loader();

            frm.__stock_taking_submit_in_progress =
                false;

            frm.enable_save();
        }
    }
});


// =========================================================
// LOADER
// =========================================================

function show_stock_taking_loader(
    title,
    message
) {

    let loader =
        document.getElementById(
            "stock-taking-submit-loader"
        );

    if (!loader) {

        loader =
            document.createElement(
                "div"
            );

        loader.id =
            "stock-taking-submit-loader";

        loader.innerHTML = `

            <div class="stock-taking-loader-box">

                <div class="stock-taking-spinner"></div>

                <div class="stock-taking-loader-title"></div>

                <div class="stock-taking-loader-message"></div>

            </div>
        `;

        document.body.appendChild(
            loader
        );

        const style =
            document.createElement(
                "style"
            );

        style.id =
            "stock-taking-loader-style";

        style.innerHTML = `

            #stock-taking-submit-loader {

                position: fixed;
                top: 0;
                left: 0;

                width: 100vw;
                height: 100vh;

                background:
                    rgba(255,255,255,0.75);

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
                    0 10px 40px
                    rgba(0,0,0,0.20);
            }

            .stock-taking-spinner {

                width: 45px;
                height: 45px;

                margin:
                    0 auto 20px auto;

                border:
                    4px solid #e5e7eb;

                border-top:
                    4px solid #2490ef;

                border-radius: 50%;

                animation:
                    stockTakingSpin
                    0.8s linear infinite;
            }

            .stock-taking-loader-title {

                font-size: 18px;

                font-weight: 600;

                margin-bottom: 8px;
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

        document.head.appendChild(
            style
        );
    }

    let title_element =
        loader.querySelector(
            ".stock-taking-loader-title"
        );

    let message_element =
        loader.querySelector(
            ".stock-taking-loader-message"
        );

    if (title_element) {
        title_element.textContent =
            title;
    }

    if (message_element) {
        message_element.textContent =
            message;
    }

    loader.style.display =
        "flex";

    document.body.style.overflow =
        "hidden";
}


// =========================================================
// HIDE LOADER
// =========================================================

function hide_stock_taking_loader() {

    let loader =
        document.getElementById(
            "stock-taking-submit-loader"
        );

    if (loader) {

        loader.style.display =
            "none";
    }

    document.body.style.overflow =
        "";
}


// =========================================================
// CREATE DELIVERY NOTE
// =========================================================

async function create_delivery_note(
    frm,
    items
) {

    if (
        !items ||
        !items.length
    ) {
        return;
    }

    // -----------------------------------------------------
    // GET DEFAULT WAREHOUSE
    // -----------------------------------------------------

    let warehouses = [];

    if (
        Array.isArray(
            frm.doc.warehouse
        )
    ) {

        warehouses =
            frm.doc.warehouse
                .map(
                    row =>
                        row.warehuose ||
                        row.warehouse
                )
                .filter(Boolean);

    } else if (
        typeof frm.doc.warehouse ===
        "string"
    ) {

        warehouses =
            frm.doc.warehouse
                .split("\n")
                .map(
                    w => w.trim()
                )
                .filter(Boolean);
    }

    // -----------------------------------------------------
    // FALLBACK
    // -----------------------------------------------------

    if (
        !warehouses.length
    ) {

        warehouses =
            (
                frm.doc.items ||
                []
            )
                .map(
                    row =>
                        row.warehouse
                )
                .filter(Boolean);
    }

    warehouses =
        [
            ...new Set(
                warehouses
            )
        ];

    if (
        !warehouses.length
    ) {

        frappe.throw(
            __(
                "Please select at least one Warehouse."
            )
        );
    }

    let set_warehouse =
        warehouses[0];


    // =====================================================
    // GROUP ITEMS
    // =====================================================

    let grouped = {};

    for (
        let row of items
    ) {

        if (!row.item_code) {
            continue;
        }

        let warehouse =
            row.warehouse ||
            set_warehouse;

        let key =
            `${row.item_code}__${warehouse}`;

        if (!grouped[key]) {

            grouped[key] = {

                item_code:
                    row.item_code,

                warehouse:
                    warehouse,

                qty: 0,

                serials: []
            };
        }

        grouped[key].qty +=
            flt(
                row.qty
            );

        if (
            row.serial_no
        ) {

            grouped[key]
                .serials.push(
                    ...String(
                        row.serial_no
                    )
                        .split("\n")
                        .map(
                            s => s.trim()
                        )
                        .filter(Boolean)
                );
        }
    }


    // =====================================================
    // BUILD ITEMS
    // =====================================================

    let dn_items =
        Object.values(
            grouped
        ).map(
            row => ({

                item_code:
                    row.item_code,

                qty:
                    row.qty,

                warehouse:
                    row.warehouse,

                serial_no:
                    [
                        ...new Set(
                            row.serials
                        )
                    ].join("\n")
            })
        )
        .filter(
            row =>
                flt(row.qty) > 0
        );


    if (
        !dn_items.length
    ) {
        return;
    }


    // =====================================================
    // DOCUMENT
    // =====================================================

    let dn_doc = {

        doctype:
            "Delivery Note",

        company:
            frm.doc.company,

        set_warehouse:
            set_warehouse,

        custom_stock_taking:
            frm.doc.name,

        items:
            dn_items
    };


    console.log(
        "Optimized Delivery Note:",
        dn_doc
    );


    // =====================================================
    // API
    // =====================================================

    let response =
        await frappe.call({

            method:
                "stock_taking.stock_taking.doctype.stock_taking.stock_taking.create_delivery_note",

            args: {

                doc:
                    JSON.stringify(
                        dn_doc
                    )
            },

            freeze: true,

            freeze_message:
                __(
                    "Creating Delivery Note..."
                )
        });


    if (
        response.message
    ) {

        frappe.show_alert({

            message:
                __(
                    "Delivery Note {0} created successfully"
                ).replace(
                    "{0}",
                    response.message.name
                ),

            indicator:
                "green"
        });
    }
}


// =========================================================
// CREATE RETURN DELIVERY NOTE
// =========================================================

async function create_delivery_note_return(
    frm,
    items
) {

    if (
        !items ||
        !items.length
    ) {
        return;
    }


    // =====================================================
    // WAREHOUSE
    // =====================================================

    let warehouses = [];

    if (
        Array.isArray(
            frm.doc.warehouse
        )
    ) {

        warehouses =
            frm.doc.warehouse
                .map(
                    row =>
                        row.warehuose ||
                        row.warehouse
                )
                .filter(Boolean);
    }

    if (
        !warehouses.length
    ) {

        warehouses =
            (
                frm.doc.items ||
                []
            )
                .map(
                    row =>
                        row.warehouse
                )
                .filter(Boolean);
    }

    warehouses =
        [
            ...new Set(
                warehouses
            )
        ];

    if (
        !warehouses.length
    ) {

        frappe.throw(
            __(
                "Warehouse is required to create Delivery Note Return."
            )
        );
    }


    let default_warehouse =
        warehouses[0];


    // =====================================================
    // GROUP
    // =====================================================

    let grouped = {};

    items.forEach(
        row => {

            if (!row.item_code) {
                return;
            }

            let warehouse =
                row.warehouse ||
                default_warehouse;

            let key =
                `${row.item_code}__${warehouse}`;

            if (
                !grouped[key]
            ) {

                grouped[key] = {

                    item_code:
                        row.item_code,

                    warehouse:
                        warehouse,

                    qty: 0,

                    serials: []
                };
            }

            grouped[key].qty +=
                flt(
                    row.qty
                );

            if (
                row.serial_no
            ) {

                grouped[key]
                    .serials.push(
                        ...String(
                            row.serial_no
                        )
                            .split("\n")
                            .map(
                                s => s.trim()
                            )
                            .filter(Boolean)
                    );
            }
        }
    );


    // =====================================================
    // BUILD
    // =====================================================

    let dn_items =
        Object.values(
            grouped
        )
            .map(
                row => {

                    let item = {

                        item_code:
                            row.item_code,

                        qty:
                            row.qty,

                        warehouse:
                            row.warehouse
                    };

                    if (
                        row.serials.length
                    ) {

                        item.serial_no =
                            [
                                ...new Set(
                                    row.serials
                                )
                            ].join("\n");
                    }

                    return item;
                }
            )
            .filter(
                row =>
                    flt(row.qty) > 0
            );


    if (
        !dn_items.length
    ) {
        return;
    }


    // =====================================================
    // DOCUMENT
    // =====================================================

    let dn_doc = {

        doctype:
            "Delivery Note",

        is_return:
            1,

        company:
            frm.doc.company,

        set_warehouse:
            default_warehouse,

        custom_stock_taking:
            frm.doc.name,

        items:
            dn_items
    };


    console.log(
        "Optimized Return Delivery Note:",
        dn_doc
    );


    // =====================================================
    // API
    // =====================================================

    let response =
        await frappe.call({

            method:
                "stock_taking.stock_taking.doctype.stock_taking.stock_taking.create_delivery_note_return",

            args: {

                doc:
                    JSON.stringify(
                        dn_doc
                    )
            },

            freeze: true,

            freeze_message:
                __(
                    "Creating Delivery Note Return..."
                )
        });


    if (
        !response.message
    ) {

        frappe.throw(
            __(
                "Failed to create Delivery Note Return."
            )
        );
    }
}


// =========================================================
// SERIAL SCAN
// =========================================================

function handle_serial_scan(
    frm,
    serial
) {

    let is_active =
        serial.status === "Active";

    let parent_warehouse =
        "";

    if (
        Array.isArray(
            frm.doc.warehouse
        ) &&
        frm.doc.warehouse.length
    ) {

        parent_warehouse =
            frm.doc.warehouse[0]
                .warehuose ||
            frm.doc.warehouse[0]
                .warehouse ||
            "";
    }


    let warehouse =
        is_active
            ? (
                serial.warehouse ||
                parent_warehouse
            )
            : parent_warehouse;


    let row =
        frm.doc.items.find(
            d =>
                d.item_code ===
                    serial.item_code &&
                d.warehouse ===
                    warehouse &&
                (
                    (
                        is_active &&
                        !d.is_delivered_row
                    ) ||
                    (
                        !is_active &&
                        d.is_delivered_row
                    )
                )
        );


    if (!row) {

        row =
            frm.add_child(
                "items"
            );

        row.item_code =
            serial.item_code;

        row.warehouse =
            warehouse;

        row.serial_no =
            "";

        row.physical_count =
            0;

        row.is_delivered_row =
            is_active
                ? 0
                : 1;
    }


    frappe.call({

        method:
            "stock_taking.stock_taking.doctype.stock_taking.stock_taking.get_system_serials",

        args: {

            item_code:
                serial.item_code,

            warehouse:
                warehouse
        }

    }).then(
        r => {

            let system_serials =
                r.message || [];


            if (is_active) {

                row.inventory =
                    system_serials.length;

            } else {

                row.inventory =
                    0;
            }


            let existing =
                row.serial_no
                    ? String(
                        row.serial_no
                    )
                        .split("\n")
                        .map(
                            s => s.trim()
                        )
                        .filter(Boolean)
                    : [];


            if (
                !existing.includes(
                    serial.name
                )
            ) {

                existing.push(
                    serial.name
                );
            }


            row.serial_no =
                existing.join("\n");

            row.physical_count =
                existing.length;


            frm.refresh_field(
                "items"
            );

            update_total_quantity(
                frm
            );
        }
    );
}


// =========================================================
// PROCESS SCAN
// =========================================================

function process_scan(
    frm,
    scanned_code
) {

    if (
        !frm.doc.stock_selection
    ) {

        frappe.msgprint({
            title:
                __("Mandatory"),

            message:
                __(
                    "Please select Stock Location Type first"
                ),

            indicator:
                "red"
        });

        return;
    }


    if (
        !frm.doc.warehouse ||
        !frm.doc.warehouse.length
    ) {

        frappe.msgprint({
            title:
                __("Mandatory"),

            message:
                __(
                    "Please select Warehouse first"
                ),

            indicator:
                "red"
        });

        return;
    }


    if (!scanned_code) {
        return;
    }


    let warehouse_list =
        frm.doc.warehouse
            .map(
                w =>
                    w.warehouse ||
                    w.warehuose ||
                    w
            )
            .filter(Boolean);


    frappe.call({

        method:
            "stock_taking.stock_taking.doctype.stock_taking.stock_taking.scan_barcode",

        args: {

            code:
                scanned_code,

            warehouses:
                warehouse_list
        }

    }).then(
        r => {

            const res =
                r.message;


            if (
                !res ||
                !res.success
            ) {

                frappe.msgprint(
                    res?.message ||
                    "Invalid barcode"
                );

                return;
            }


            if (
                res.type ===
                "serial"
            ) {

                handle_serial_scan(
                    frm,
                    res.result
                );

                return;
            }


            if (
                res.type ===
                "item"
            ) {

                (
                    res.result ||
                    []
                ).forEach(
                    bin => {

                        let row =
                            frm.doc.items.find(
                                d =>
                                    d.item_code ===
                                        bin.item_code &&
                                    d.warehouse ===
                                        bin.warehouse
                            );


                        if (!row) {

                            row =
                                frm.add_child(
                                    "items"
                                );

                            row.item_code =
                                bin.item_code;

                            row.warehouse =
                                bin.warehouse;

                            row.serial_no =
                                "";

                            row.inventory =
                                flt(
                                    bin.actual_qty
                                );

                            row.physical_count =
                                0;
                        }


                        row.physical_count =
                            (
                                flt(
                                    row.physical_count
                                ) ||
                                0
                            ) + 1;
                    }
                );


                frm.refresh_field(
                    "items"
                );

                update_total_quantity(
                    frm
                );
            }
        }
    );
}


// =========================================================
// CHILD EVENTS
// =========================================================

frappe.ui.form.on(
    "Stock taking Items",
    {

        physical_count(
            frm
        ) {

            update_total_quantity(
                frm
            );
        },

        items_remove(
            frm
        ) {

            update_total_quantity(
                frm
            );
        }
    }
);


// =========================================================
// TOTAL
// =========================================================

function update_total_quantity(
    frm
) {

    let total = 0;

    (
        frm.doc.items ||
        []
    ).forEach(
        row => {

            total +=
                flt(
                    row.physical_count ||
                    0
                );
        }
    );

    frm.set_value(
        "total_quantity",
        total
    );
}


// =========================================================
// DIFFERENCE
// =========================================================

function calculate_differences(
    frm
) {

    let changed =
        false;

    (
        frm.doc.items ||
        []
    ).forEach(
        row => {

            if (
                row.is_diff_warehouse_row
            ) {

                if (
                    row.difference !== 0
                ) {

                    row.difference =
                        0;

                    changed =
                        true;
                }

                return;
            }


            const inventory =
                flt(
                    row.inventory
                ) || 0;

            const physical =
                flt(
                    row.physical_count
                ) || 0;

            const diff =
                physical -
                inventory;


            if (
                row.difference !==
                diff
            ) {

                row.difference =
                    diff;

                changed =
                    true;
            }
        }
    );


    if (changed) {

        frm.refresh_field(
            "items"
        );
    }
}


// =========================================================
// UPDATE CHILD WAREHOUSE
// =========================================================

function update_child_warehouse(
    frm
) {

    if (
        !frm.doc.warehouse ||
        !frm.doc.warehouse.length
    ) {
        return;
    }


    const parent_warehouse =
        frm.doc.warehouse[0]
            .warehuose ||
        frm.doc.warehouse[0]
            .warehouse;


    if (!parent_warehouse) {
        return;
    }


    (
        frm.doc.items ||
        []
    ).forEach(
        row => {

            if (
                row.warehouse &&
                row.warehouse !==
                    parent_warehouse
            ) {

                row.is_diff_warehouse_row =
                    1;

                row.warehouse =
                    parent_warehouse;
            }
        }
    );


    frm.refresh_field(
        "items"
    );


    calculate_differences(
        frm
    );
}


// =========================================================
// WAREHOUSE FILTER
// =========================================================

function get_warehouse_filter(
    frm
) {

    const company =
        frm.doc.company;

    const stock_selection =
        frm.doc.stock_selection;


    if (!company) {

        return {
            filters: {
                name: [
                    "is",
                    "set_to_null"
                ]
            }
        };
    }


    let filters = {
        company:
            company
    };


    if (
        stock_selection ===
        "Warehouse Selection"
    ) {

        filters.is_group =
            1;

        filters.parent_warehouse =
            [
                "in",
                [
                    "",
                    null
                ]
            ];

    } else if (
        stock_selection ===
        "Zone Selection"
    ) {

        filters.is_group =
            0;

        filters.parent_warehouse =
            [
                "!=",
                ""
            ];

    } else if (
        stock_selection ===
        "Bin Selection"
    ) {

        filters.is_group =
            0;
    }


    return {
        filters:
            filters
    };
}


// =========================================================
// APPLY WAREHOUSE FILTER
// =========================================================

function apply_warehouse_filter(
    frm
) {

    const query =
        () =>
            get_warehouse_filter(
                frm
            );


    if (
        frm.fields_dict[
            "warehouse"
        ]
    ) {

        frm.set_query(
            "warehouse",
            query
        );
    }


    if (
        frm.fields_dict[
            "items"
        ]
    ) {

        const grid =
            frm.fields_dict[
                "items"
            ].grid;


        [
            "warehouse",
            "s_warehouse",
            "t_warehouse"
        ].forEach(
            fieldname => {

                if (
                    grid.get_field(
                        fieldname
                    )
                ) {

                    grid.get_field(
                        fieldname
                    ).get_query =
                        query;
                }
            }
        );


        grid.refresh();
    }
}

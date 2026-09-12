frappe.query_reports["Stock Take Analysis Report"] = {

    filters: [

        // =========================================================
        // COMPANY
        // =========================================================
       {
    fieldname: "company",
    label: __("Company"),
    fieldtype: "Link",
    options: "Company",
    width: 180,
    default: "",

    on_change: function(report) {

        let company = report.get_filter_value("company");

        if (!company) {

            report.set_filter_value("stock_taking", "");
            report.set_filter_value("warehouse", "");
            report.set_filter_value("from_date", "");
            report.set_filter_value("to_date", "");
            report.set_filter_value("time", "");

            return;
        }

        // =================================================
        // GET LATEST STOCK TAKING FOR COMPANY
        // =================================================

        frappe.call({
            method: "frappe.client.get_list",

            args: {
                doctype: "Stock Taking",

                filters: {
                    company: company,
                    docstatus: ["!=", 2]
                },

                fields: [
                    "name",
                    "plan_date",
                    "plan_time",
                    "creation",
                    "modified"
                ],

                // Latest created/modified Stock Taking first
                order_by: "modified desc",

                limit_page_length: 1
            },

            callback: function(r) {

                if (
                    !r.message ||
                    !r.message.length
                ) {

                    report.set_filter_value(
                        "stock_taking",
                        ""
                    );

                    report.set_filter_value(
                        "warehouse",
                        ""
                    );

                    report.set_filter_value(
                        "from_date",
                        ""
                    );

                    report.set_filter_value(
                        "to_date",
                        ""
                    );

                    report.set_filter_value(
                        "time",
                        ""
                    );

                    return;
                }

                let stock_taking =
                    r.message[0].name;

                report.set_filter_value(
                    "stock_taking",
                    stock_taking
                );

                set_stock_taking_filters(
                    report,
                    stock_taking
                );
            }
        });
    }
},


        // =========================================================
        // WAREHOUSE
        // =========================================================
        {
            fieldname: "warehouse",
            label: __("Warehouse"),
            fieldtype: "Link",
            options: "Warehouse",
            width: 180,

            read_only: 1,

            get_query: function() {

                let company =
                    frappe.query_report.get_filter_value(
                        "company"
                    );

                if (!company) {
                    return {};
                }

                return {
                    filters: {
                        company: company
                    }
                };
            }
        },


        // =========================================================
        // ITEM CODE
        // =========================================================
        {
            fieldname: "item_code",
            label: __("Item Code"),
            fieldtype: "Link",
            options: "Item",
            width: 180
        },


        // =========================================================
        // STOCK TAKING
        // =========================================================
        {
            fieldname: "stock_taking",
            label: __("Stock Taking"),
            fieldtype: "Link",
            options: "Stock Taking",
            width: 180,

            get_query: function() {

                let company =
                    frappe.query_report.get_filter_value(
                        "company"
                    );

                if (!company) {
                    return {};
                }

                return {
                    filters: {
                        company: company
                    }
                };
            },

            on_change: function(report) {

                let stock_taking =
                    report.get_filter_value(
                        "stock_taking"
                    );

                if (!stock_taking) {

                    report.set_filter_value(
                        "warehouse",
                        ""
                    );

                    report.set_filter_value(
                        "from_date",
                        ""
                    );

                    report.set_filter_value(
                        "to_date",
                        ""
                    );

                    report.set_filter_value(
                        "time",
                        ""
                    );

                    return;
                }

                set_stock_taking_filters(
                    report,
                    stock_taking
                );
            }
        },


        // =========================================================
        // FROM DATE
        // =========================================================
        {
            fieldname: "from_date",
            label: __("From Date"),
            fieldtype: "Date",
            width: 120,

            read_only: 1,

            default: ""
        },


        // =========================================================
        // TO DATE
        // =========================================================
        {
            fieldname: "to_date",
            label: __("To Date"),
            fieldtype: "Date",
            width: 120,

            read_only: 1,

            default: ""
        },


        // =========================================================
        // TIME
        // =========================================================
        {
            fieldname: "time",
            label: __("Time"),
            fieldtype: "Time",
            width: 120,

            read_only: 1,

            default: ""
        },


        // =========================================================
        // STATUS
        // =========================================================
        {
            fieldname: "status",
            label: __("Status"),
            fieldtype: "Select",
            options: "\nDraft\nSubmitted\nCancelled",
            width: 150,

            default: ""
        },


        // =========================================================
        // SERIAL NO
        // =========================================================
        {
            fieldname: "show_serial_no",
            label: __("Segregate Serial No"),
            fieldtype: "Check",
            default: 0
        }
    ],


    // =============================================================
    // FORMATTER
    // =============================================================
    formatter: function(
        value,
        row,
        column,
        data,
        default_formatter
    ) {

        value = default_formatter(
            value,
            row,
            column,
            data
        );

        const cols = [
            "book_stock",
            "physical_stock",
            "difference",
            "excess_qty",
            "short_qty",
            "stock_adj_qty"
        ];

        if (
            !data ||
            !cols.includes(column.fieldname)
        ) {
            return value;
        }

        let qty = flt(
            data[column.fieldname]
        );

        if (qty > 0) {

            return `
                <span style="color:green;font-weight:600;">
                    +${qty}
                </span>
            `;
        }

        if (qty < 0) {

            return `
                <span style="color:red;font-weight:600;">
                    ${qty}
                </span>
            `;
        }

        return `
            <span style="font-weight:600;">
                0
            </span>
        `;
    }
};


// =============================================================
// COMMON FUNCTION
// =============================================================

function set_stock_taking_filters(
    report,
    stock_taking
) {

    if (!stock_taking) {
        return;
    }

    frappe.call({

        method: "frappe.client.get",

        args: {
            doctype: "Stock Taking",
            name: stock_taking
        },

        callback: function(r) {

            if (!r.message) {
                return;
            }

            let doc = r.message;


            // =====================================================
            // PLAN DATE
            // =====================================================

            let plan_date =
                doc.plan_date || "";


            // =====================================================
            // PLAN TIME
            // =====================================================

           let plan_time = doc.plan_time || "";

            // =====================================================
            // FORMAT TIME AS HH:mm:ss
            // Frappe Time field requires leading zero
            // Example: 8:58:17 -> 08:58:17
            // =====================================================

            if (plan_time) {

                let parts = String(plan_time).split(":");

                let hours = String(parts[0] || "0").padStart(2, "0");
                let minutes = String(parts[1] || "0").padStart(2, "0");
                let seconds = String(parts[2] || "0").padStart(2, "0");

                plan_time =
                    `${hours}:${minutes}:${seconds}`;
            }

            report.set_filter_value(
                "time",
                plan_time
            );


            // =====================================================
            // WAREHOUSE
            // =====================================================

            let warehouse = "";

            if (
                doc.items &&
                doc.items.length
            ) {

                let first_item =
                    doc.items.find(function(row) {

                        return row.warehouse;
                    });

                if (first_item) {

                    warehouse =
                        first_item.warehouse;
                }
            }


            // =====================================================
            // SET WAREHOUSE
            // =====================================================

            report.set_filter_value(
                "warehouse",
                warehouse
            );


            // =====================================================
            // FROM DATE
            //
            // Stock Taking Plan Date
            // =====================================================

            report.set_filter_value(
                "from_date",
                plan_date
            );


            // =====================================================
            // TO DATE
            //
            // IMPORTANT:
            //
            // Stock Balance closing date
            //
            // Current report requirement:
            // 18-08-2026
            //
            // Automatically use today's date.
            // =====================================================

            let today =
                frappe.datetime.get_today();

            report.set_filter_value(
                "to_date",
                today
            );


            // =====================================================
            // TIME
            //
            // Stock Taking plan time
            // =====================================================

            report.set_filter_value(
                "time",
                plan_time
            );
        }
    });
}
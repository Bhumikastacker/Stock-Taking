frappe.query_reports["Stock Take Analysis Report"] = {

    filters: [

        {
            fieldname: "company",
            label: __("Company"),
            fieldtype: "Link",
            options: "Company",
            width: 180,
            default: frappe.defaults.get_user_default("Company"),

            on_change: function(report) {

                // Clear dependent filters
                report.set_filter_value("warehouse", "");
                report.set_filter_value("stock_taking", "");

                // Refresh report with new company
                frappe.query_report.refresh();
            }
        },

        {
            fieldname: "warehouse",
            label: __("Warehouse"),
            fieldtype: "Link",
            options: "Warehouse",
            width: 180,

            get_query: function() {

                let company =
                    frappe.query_report.get_filter_value("company");

                return {
                    filters: {
                        company: company
                    }
                };
            }
        },

        {
            fieldname: "item_code",
            label: __("Item Code"),
            fieldtype: "Link",
            options: "Item",
            width: 180
        },

        {
            fieldname: "stock_taking",
            label: __("Stock Taking"),
            fieldtype: "Link",
            options: "Stock Taking",
            width: 180,

            get_query: function() {

                let company =
                    frappe.query_report.get_filter_value("company");

                return {
                    filters: {
                        company: company
                    }
                };
            }
        },

        {
            fieldname: "from_date",
            label: __("From Date"),
            fieldtype: "Date",
            width: 120,
            default: frappe.datetime.get_today()
        },

        {
            fieldname: "to_date",
            label: __("To Date"),
            fieldtype: "Date",
            width: 120,
            default: frappe.datetime.get_today()
        },


        {
            fieldname: "status",
            label: __("Status"),
            fieldtype: "Select",
            options: "\nDraft\nSubmitted\nCancelled",
            width: 150,
            // default: "Submitted"
        },

        {
            fieldname: "show_serial_no",
            label: __("Segregate Serial No"),
            fieldtype: "Check",
            default: 0
        }
    ],

    // after_datatable_render: function(datatable) {

    //     const highlightColumns = [
    //         "short_qty",
    //         "excess_qty",
    //         "stock_adj_qty",
    //         "difference",
    //         "physical_stock",
    //         "book_stock"
    //     ];

    //     highlightColumns.forEach(fieldname => {

    //         const colIndex = datatable.datamanager.getColumns()
    //             .findIndex(col => col.id === fieldname);

    //         if (colIndex === -1) return;

    //         datatable.wrapper
    //             .querySelectorAll(`.dt-cell--col-${colIndex}`)
    //             .forEach(cell => {

    //                 let qty = parseFloat(cell.innerText.trim());

    //                 if (isNaN(qty)) return;

    //                 const content = cell.querySelector(".dt-cell__content");
    //                 if (!content) return;

    //                 content.style.fontWeight = "600";

    //                 if (qty > 0) {
    //                     content.style.color = "#198754"; // Green

    //                     // + sign only once
    //                     if (!content.innerText.trim().startsWith("+")) {
    //                         content.innerText = "+" + qty;
    //                     }

    //                 } else if (qty < 0) {
    //                     content.style.color = "#dc3545"; // Red
    //                 } else {
    //                     content.style.color = "";
    //                 }

    //             });

    //     });

    // }
    formatter: function(value, row, column, data, default_formatter) {

        value = default_formatter(value, row, column, data);

        const cols = [
            "book_stock",
            "physical_stock",
            "difference",
            "excess_qty",
            "short_qty",
            "stock_adj_qty"
        ];

        if (!data || !cols.includes(column.fieldname)) {
            return value;
        }

        let qty = flt(data[column.fieldname]);

        if (qty > 0) {
            return `<span style="color:green;font-weight:600;">+${qty}</span>`;
        }

        if (qty < 0) {
            return `<span style="color:red;font-weight:600;">${qty}</span>`;
        }

        return `<span style="font-weight:600;">0</span>`;
    }





    
};

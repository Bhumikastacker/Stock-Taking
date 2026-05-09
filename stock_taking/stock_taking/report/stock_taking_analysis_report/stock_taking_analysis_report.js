frappe.query_reports["Stock Taking Analysis Report"] = {

    filters: [

        {
            fieldname: "from_date",
            label: __("From Date"),
            fieldtype: "Date",
            width: 120
        },

        {
            fieldname: "to_date",
            label: __("To Date"),
            fieldtype: "Date",
            width: 120
        },

        {
            fieldname: "company",
            label: __("Company"),
            fieldtype: "Link",
            options: "Company",
            width: 180
        },

        {
            fieldname: "warehouse",
            label: __("Warehouse"),
            fieldtype: "Link",
            options: "Warehouse",
            width: 180
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
            width: 180
        },

        // ✅ NEW CHECKBOX
        {
            fieldname: "show_serial_no",
            label: __("Segregate Serial No"),
            fieldtype: "Check",
            default: 0
        }
    ]
};
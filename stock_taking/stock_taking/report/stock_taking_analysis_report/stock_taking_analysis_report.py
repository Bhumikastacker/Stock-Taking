import frappe
from frappe import _
from frappe.utils import flt


def execute(filters=None):

    columns = get_columns(filters)
    data = get_data(filters)

    # =========================
    # CUSTOM TOTALS
    # =========================
    total_book_stock = 0
    total_physical_stock = 0
    total_difference = 0
    total_stock_adj_qty = 0
    total_standard_rate = 0
    total_wsp = 0

    for d in data:

        total_book_stock += flt(d.get("book_stock"))
        total_physical_stock += flt(d.get("physical_stock"))
        total_difference += flt(d.get("difference"))
        total_stock_adj_qty += flt(d.get("stock_adj_qty"))

        total_standard_rate += flt(d.get("standard_rate"))
        total_wsp += flt(d.get("wsp"))

    # =========================
    # TOTAL ROW
    # =========================
    data.append({

        "stock_taking": "TOTAL",

        "standard_rate": total_standard_rate,
        "wsp": total_wsp,

        "book_stock": total_book_stock,
        "physical_stock": total_physical_stock,
        "difference": total_difference,
        "stock_adj_qty": total_stock_adj_qty
    })

    return columns, data

def get_columns(filters=None):

    columns = [

        {
            "label": "Stock Taking",
            "fieldname": "stock_taking",
            "fieldtype": "Link",
            "options": "Stock Taking",
            "width": 180
        },

        {
            "label": "Owner Site",
            "fieldname": "owner_site",
            "fieldtype": "Data",
            "width": 180
        },

        {
            "label": "Item Code",
            "fieldname": "item_code",
            "fieldtype": "Link",
            "options": "Item",
            "width": 150
        },

        {
            "label": "Article Name",
            "fieldname": "article_name",
            "fieldtype": "Data",
            "width": 180
        },

        {
            "label": "Standard Rate",
            "fieldname": "standard_rate",
            "fieldtype": "Currency",
            "width": 120
        },

        {
            "label": "WSP",
            "fieldname": "wsp",
            "fieldtype": "Currency",
            "width": 120
        },

        {
            "label": "Division",
            "fieldname": "division",
            "fieldtype": "Data",
            "width": 150
        },

        {
            "label": "Stock Adj Date",
            "fieldname": "stock_adj_date",
            "fieldtype": "Date",
            "width": 120
        },

        {
            "label": "Plan Date",
            "fieldname": "plan_date",
            "fieldtype": "Date",
            "width": 120
        },

        {
            "label": "Plan Description",
            "fieldname": "plan_description",
            "fieldtype": "Data",
            "width": 220
        },

        {
            "label": "Category1",
            "fieldname": "category1",
            "fieldtype": "Data",
            "width": 120
        },

        {
            "label": "Category2",
            "fieldname": "category2",
            "fieldtype": "Data",
            "width": 120
        },

        {
            "label": "Category3",
            "fieldname": "category3",
            "fieldtype": "Data",
            "width": 120
        },

        {
            "label": "Category4",
            "fieldname": "category4",
            "fieldtype": "Data",
            "width": 120
        },

        {
            "label": "Category5",
            "fieldname": "category5",
            "fieldtype": "Data",
            "width": 120
        },

        {
            "label": "Category6",
            "fieldname": "category6",
            "fieldtype": "Data",
            "width": 120
        },

        {
            "label": "Book Stock",
            "fieldname": "book_stock",
            "fieldtype": "Float",
            "width": 120
        },

        {
            "label": "Physical Stock",
            "fieldname": "physical_stock",
            "fieldtype": "Float",
            "width": 120
        },

        {
            "label": "Difference",
            "fieldname": "difference",
            "fieldtype": "Float",
            "width": 120
        },

        {
            "label": "Stock Adj Qty",
            "fieldname": "stock_adj_qty",
            "fieldtype": "Float",
            "width": 120
        },

        {
            "label": "Stock Point",
            "fieldname": "stock_point",
            "fieldtype": "Link",
            "options": "Warehouse",
            "width": 180
        }
    ]

    # ✅ SHOW SERIAL COLUMN
    if filters.get("show_serial_no"):

        columns.append({
            "label": "Serial No",
            "fieldname": "serial_no",
            "fieldtype": "HTML",
            "width": 400
        })

    return columns

def get_data(filters):

    conditions = ""

    if filters.get("company"):
        conditions += f" AND st.company = '{filters.get('company')}' "

    if filters.get("stock_taking"):
        conditions += f" AND st.name = '{filters.get('stock_taking')}' "

    if filters.get("item_code"):
        conditions += f" AND sti.item_code = '{filters.get('item_code')}' "

    if filters.get("warehouse"):
        conditions += f" AND sti.warehouse = '{filters.get('warehouse')}' "

    if filters.get("from_date"):
        conditions += f" AND st.plan_date >= '{filters.get('from_date')}' "

    if filters.get("to_date"):
        conditions += f" AND st.plan_date <= '{filters.get('to_date')}' "

    return frappe.db.sql(f"""

    SELECT

        st.name as stock_taking,
        st.company as owner_site,

        GROUP_CONCAT(
            DISTINCT sti.serial_no
            SEPARATOR '<br>'
        ) as serial_no,

        sti.difference as stock_adj_qty,

        sti.warehouse as stock_point,

        sti.item_code,

        i.brand as article_name,

            ip_mrp.price_list_rate as standard_rate,

            ip_wsp.price_list_rate as wsp,

            i.item_group as division,

            CURDATE() as stock_adj_date,

            st.plan_date,

            st.remark as plan_description,

            i.custom_count_of_pcs as category1,
            i.custom_top_fabrics as category2,
            i.custom_colour_name as category3,
            i.custom_set_qty as category4,
            i.custom_size as category5,
            i.custom_dupatta_length as category6,

            sti.inventory as book_stock,
            sti.physical_count as physical_stock,
            sti.difference as difference,
            sti.difference as stock_adj_qty,

            sti.warehouse as stock_point

        FROM `tabStock Taking` st

        INNER JOIN `tabStock taking Items` sti
            ON sti.parent = st.name

        LEFT JOIN `tabItem` i
            ON i.name = sti.item_code

        LEFT JOIN `tabItem Price` ip_mrp
            ON ip_mrp.item_code = sti.item_code
            AND ip_mrp.price_list = 'MRP'

        LEFT JOIN `tabItem Price` ip_wsp
            ON ip_wsp.item_code = sti.item_code
            AND ip_wsp.price_list = 'WSP'

       WHERE st.docstatus = 1

{conditions}

GROUP BY
    st.name,
    sti.item_code,
    sti.warehouse

ORDER BY st.creation DESC

    """, as_dict=1)
import Graph from "graphology";
import Sigma from "sigma";



type DeliveryItem = {
  deliveryDocument: string;
  referenceSdDocument: string;
};

type BillingItem = {
  billingDocument: string;
  referenceSdDocument: string;
};

type SalesOrder = {
  salesOrder: string;
  soldToParty: string;
};

type BillingHeader = {
  billingDocument: string;
  accountingDocument: string;
  [key: string]: any;
};

type Payment = {
  accountingDocument: string;
  invoiceReference: string;
  [key: string]: any;
};

const graph = new Graph();

const container = document.getElementById("container") as HTMLElement;

if (!container) throw new Error("Container not found");

// -------------------- LOADERS --------------------

async function loadJsonl(path: string) {
  const res = await fetch(path);
  const text = await res.text();
  return text.split("\n").filter(Boolean).map((line) => JSON.parse(line));
}

async function loadAllJsonl(folder: string, files: string[]) {
  const results: any[] = [];

  for (const file of files) {
    const data = await loadJsonl(`/sap-o2c-data/${folder}/${file}`);
    results.push(...data);
  }

  return results;
}

// -------------------- LAYOUT --------------------

function getRingPosition(index: number, total: number, radius: number) {
  const angle = (index / total) * 2 * Math.PI;
  return {
    x: radius * Math.cos(angle),
    y: radius * Math.sin(angle),
  };
}

const RADIUS = {
  customer: 1.5,   // 👈 spread them out
  sales: 3,
  delivery: 5,
  billing: 7,
  accounting: 9,
  payment: 11,
};

// -------------------- MAIN --------------------

async function main() {
  // Load ALL data
  const salesOrders = await loadJsonl(
    "/sap-o2c-data/sales_order_headers/part-20251119-133429-440.jsonl"
  ) as SalesOrder[]

  const bpData = await loadJsonl(
    "/sap-o2c-data/business_partners/part-20251119-133435-168.jsonl"
  );

  const deliveryItems = await loadAllJsonl("outbound_delivery_items", [
    "part-20251119-133431-439.jsonl",
    "part-20251119-133431-626.jsonl",
  ]) as DeliveryItem[];

  const billingItems = await loadAllJsonl("billing_document_items", [
    "part-20251119-133432-233.jsonl",
    "part-20251119-133432-978.jsonl",
  ]) as BillingItem[];

  const billingHeaders = await loadAllJsonl("billing_document_headers", [
    "part-20251119-133433-228.jsonl",
    "part-20251119-133433-936.jsonl",
  ]);

  const accounting = await loadAllJsonl(
    "journal_entry_items_accounts_receivable",
    [
      "part-20251119-133433-74.jsonl",
      "part-20251119-133434-273.jsonl",
      "part-20251119-133434-581.jsonl",
      "part-20251119-133434-669.jsonl",
    ]
  );

  const payments = await loadAllJsonl("payments_accounts_receivable", [
    "part-20251119-133434-100.jsonl",
  ]);

  // -------------------- MAPS --------------------

  const bpMap = new Map();
  bpData.forEach((bp) => bpMap.set(bp.businessPartner, bp));

  const deliveryMap = new Map();
  deliveryItems.forEach((d) => {
    const key = d.referenceSdDocument;
    if (!deliveryMap.has(key)) deliveryMap.set(key, []);
    deliveryMap.get(key).push(d);
  });

  const billingMap = new Map();
  billingItems.forEach((b) => {
    const key = b.referenceSdDocument;
    if (!billingMap.has(key)) billingMap.set(key, []);
    billingMap.get(key).push(b);
  });

  const billingHeaderMap = new Map();
  billingHeaders.forEach((h) =>
    billingHeaderMap.set(h.billingDocument, h)
  );

  const paymentMap = new Map();
  payments.forEach((p) =>
    paymentMap.set(p.invoiceReference, p)
  );

  // -------------------- DERIVED DATA --------------------

  const customers = [
    ...new Set(salesOrders.map((o) => o.soldToParty)),
  ];

  // -------------------- INDICES --------------------

  let customerIndex = 0;
  let salesIndex = 0;
  let deliveryIndex = 0;
  let billingIndex = 0;
  let accountingIndex = 0;
  let paymentIndex = 0;

  // -------------------- GRAPH BUILD --------------------

  salesOrders.forEach((order) => {
    const soId = order.salesOrder;
    const custId = order.soldToParty;
    const bp = bpMap.get(custId);

    // CUSTOMER
    if (!graph.hasNode(custId)) {
      const pos = getRingPosition(
        customerIndex++,
        customers.length,
        RADIUS.customer
      );

      graph.addNode(custId, {
        label: bp?.businessPartnerFullName || custId,
        x: pos.x,
        y: pos.y,
        size: 10,
        color: bp?.businessPartnerIsBlocked ? "#ef4444" : "#16a34a",
        nodeType: "customer",
        raw: bp,
      });
    }

    // SALES ORDER
    if (!graph.hasNode(soId)) {
      const pos = getRingPosition(
        salesIndex++,
        salesOrders.length,
        RADIUS.sales
      );

      graph.addNode(soId, {
        label: "SO " + soId,
        x: pos.x,
        y: pos.y,
        size: 6,
        color: "#2563eb",
        raw: order,
      });
    }

    if (!graph.hasEdge(soId, custId)) {
      graph.addEdge(soId, custId);
    }

    // DELIVERY
    const deliveries = deliveryMap.get(soId) || [];

    deliveries.forEach((d: DeliveryItem) => {
      const delId = d.deliveryDocument;

      if (!graph.hasNode(delId)) {
      const pos = getRingPosition(
        deliveryIndex++,
        deliveryItems.length,
        RADIUS.delivery
      );

      graph.addNode(delId, {
        label: "DEL " + delId,
        x: pos.x,
        y: pos.y,
        size: 5,
        color: "#f59e0b",
      });
      }

      if (!graph.hasEdge(soId, delId)) {
      graph.addEdge(soId, delId);
      }

      // BILLING
      const billings = billingMap.get(delId) || [];

      billings.forEach((b: BillingItem) => {
      const billId = b.billingDocument;

      if (!graph.hasNode(billId)) {
        const pos = getRingPosition(
        billingIndex++,
        billingItems.length,
        RADIUS.billing
        );

        graph.addNode(billId, {
        label: "BILL " + billId,
        x: pos.x,
        y: pos.y,
        size: 5,
        color: "#ef4444",
        });
      }

      if (!graph.hasEdge(delId, billId)) {
        graph.addEdge(delId, billId);
      }

      // ACCOUNTING
      const header = billingHeaderMap.get(billId) as BillingHeader;
      const accId = header?.accountingDocument;

      if (accId) {
        if (!graph.hasNode(accId)) {
        const pos = getRingPosition(
          accountingIndex++,
          accounting.length,
          RADIUS.accounting
        );

        graph.addNode(accId, {
          label: "ACC " + accId,
          x: pos.x,
          y: pos.y,
          size: 4,
          color: "#8b5cf6",
        });
        }

        if (!graph.hasEdge(billId, accId)) {
        graph.addEdge(billId, accId);
        }

        // PAYMENT
        const payment = paymentMap.get(accId) as Payment;

        if (payment) {
        const payId = payment.accountingDocument;

        if (!graph.hasNode(payId)) {
          const pos = getRingPosition(
          paymentIndex++,
          payments.length,
          RADIUS.payment
          );

          graph.addNode(payId, {
          label: "PAY " + payId,
          x: pos.x,
          y: pos.y,
          size: 4,
          color: "#10b981",
          });
        }

        if (!graph.hasEdge(accId, payId)) {
          graph.addEdge(accId, payId);
        }
        }
      }
      });
    });
  });

  // -------------------- DEBUG --------------------

  console.log("Nodes:", graph.order);
  console.log("Edges:", graph.size);

  // -------------------- RENDER --------------------

  const renderer = new Sigma(graph, container);

  renderer.on("clickNode", ({ node }) => {
    console.log(node, graph.getNodeAttributes(node));
  });
}

main();
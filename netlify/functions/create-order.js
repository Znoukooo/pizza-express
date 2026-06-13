const { createClient } = require('@supabase/supabase-js');
const Xendit = require('xendit-node');

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: "Method Not Allowed" };
  }

  // Ambil kredensial dari Environment Variables Netlify
  const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
  
  const x = new Xendit({
    secretKey: process.env.XENDIT_SECRET_KEY, // Isi di dashboard Netlify nanti
  });
  const { Invoice } = x;
  const invoiceSpecificOptions = new Invoice({});

  try {
    const { name, type, totalPay, queueNum, cartItems } = JSON.parse(event.body);

    // 1. Simpan data awal ke Supabase dengan status 'belum bayar'
    const { data: order, error: orderErr } = await db.from('orders').insert([{
        no_antrian: queueNum,
        nama_pelanggan: name,
        tipe_pesanan: type,
        total_bayar: totalPay,
        status_pembayaran: 'belum bayar',
        status_pesanan: 'menunggu konfirmasi'
    }]).select().single();

    if (orderErr) throw orderErr;

    // 2. Simpan rincian item ke order_details
    const detailsPayload = cartItems.map(item => ({
        id_order: order.id_order,
        id_menu: item.id_menu,
        jumlah: item.qty,
        subtotal: item.harga * item.qty
    }));
    const { error: detailErr } = await db.from('order_details').insert(detailsPayload);
    if (detailErr) throw detailErr;

    // 3. Buat Invoice QRIS Xendit
    const externalId = `PIZZA-${order.id_order}-${Date.now()}`;
    const xenditInvoice = await invoiceSpecificOptions.createInvoice({
      externalID: externalId,
      amount: totalPay,
      description: `Pembayaran Pizza Express - Antrian #${queueNum}`,
      customer: {
        givenNames: name
      },
      paymentMethods: ["QRIS"], // Kunci metode pembayaran agar HANYA memunculkan QRIS
      invoiceDuration: 900 // Batas waktu scan QRIS (15 menit)
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        order_id: order.id_order,
        invoice_url: xenditInvoice.invoiceUrl // URL halaman QRIS dinamis Xendit
      })
    };

  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
};
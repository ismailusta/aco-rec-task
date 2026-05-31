export function formatReceipt(receipt, lang = 'tr') {
  const locale = lang === 'en' ? 'en-US' : 'tr-TR';
  const now = new Date();
  const dateStr = now.toLocaleString(locale, { timeZone: 'UTC' }) + ' UTC';
  const currency = receipt.currency || 'TRY';
  const symbol = lang === 'en' ? 'TRY' : '₺';
  const total =
    lang === 'en'
      ? receipt.totalReward.toFixed(2)
      : receipt.totalReward.toFixed(2).replace('.', ',');

  const labels =
    lang === 'en'
      ? {
          machine: 'MachineID',
          reward: 'Reward',
          product: 'Product',
          quantity: 'Quantity',
          rewardCol: 'Reward',
        }
      : {
          machine: 'MachineID',
          reward: 'Ödül',
          product: 'Ürün',
          quantity: 'Adet',
          rewardCol: 'Ödül',
        };

  const lines = [
    'ACO RECYCLING',
    'reverse vending recycling systems',
    '',
    `${labels.machine}: ${receipt.machineId}`,
    dateStr,
    receipt.rewardType || 'Aco Recycling Default Reward',
    '',
    `${labels.reward}: ${total} ${symbol}`,
    '',
    `${labels.product}\t${labels.quantity}\t${labels.rewardCol}`,
    '--------------------------------',
  ];

  for (const item of receipt.items || []) {
    lines.push(
      `${item.product}\t${item.quantity}\t${item.reward}`,
    );
  }

  if (receipt.qrPayload) {
    lines.push('', `[QR:${receipt.qrPayload}]`);
  }

  return lines.join('\n');
}

export function buildTextPayload(body) {
  if (body.receipt) {
    return {
      text: formatReceipt(body.receipt, body.lang || 'tr'),
      receipt: body.receipt,
      lang: body.lang || 'tr',
    };
  }

  return {
    text: body.text,
    lang: body.lang || 'tr',
    qr: body.qr || false,
  };
}

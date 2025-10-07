const PDFDocument = require('pdfkit');
const moment = require('moment');
const path = require('path');
const rajya = require('../models/state');
const SabjiMandirate = require('../models/mandirate');

// Helper: get filtered rows for the selected date and state, all columns filled, normalized trend
async function getReportRowsFull(dateStr, stateId) {
  let query = {};
  if (stateId) query.state = stateId;
  const rates = await SabjiMandirate.find(query).populate('state');
  let rows = [];
  rates.forEach(rate => {
    rate.list.forEach(item => {
      let price = null;
      if (dateStr) {
        const dt = new Date(dateStr);
        dt.setHours(0, 0, 0, 0);
        price = item.prices.find(p => {
          const pdt = new Date(p.date).setHours(0, 0, 0, 0);
          return pdt === dt.getTime();
        });
      }
      if (!price) price = item.prices[item.prices.length - 1];
      if (price) {
        item.prices.sort((a, b) => a.date - b.date);
        const idx = item.prices.findIndex(p => p === price);
        let trend = price.trend;
        if (trend === 0 && idx > 0) {
          const prev = item.prices[idx - 1];
          trend = price.minrate - prev.minrate;
        }
        let trendText = '';
        let trendColor = '#95a5a6';
        let trendArrow = '→';
        if (trend > 0) {
          trendText = 'Up';
          trendColor = '#27ae60';
          trendArrow = '↑';
        } else if (trend < 0) {
          trendText = 'Down';
          trendColor = '#c0392b';
          trendArrow = '↓';
        } else {
          trendText = 'Neutral';
        }
        rows.push({
          mandi: rate.mandi,
          state: rate.state.name,
          item: item.commodity,
          rate: `${price.minrate}${price.maxrate ? '-' + price.maxrate : ''}`,
          arrival: price.arrival ? price.arrival : '',
          type: item.type || price.type || 'COMBINE',
          trend: { text: trendText, color: trendColor, arrow: trendArrow, value: trend },
          lastUpdated: price.date ? moment(price.date).format('DD/MM/YYYY\nHH:mm') : ''
        });
      }
    });
  });
  return rows;
}

// Helper: get all latest prices for all mandis/states, all columns filled
async function getAllReportRowsFull() {
  const rates = await SabjiMandirate.find({}).populate('state');
  let rows = [];
  rates.forEach(rate => {
    rate.list.forEach(item => {
      let price = item.prices[item.prices.length - 1];
      if (price) {
        let trend = price.trend || 0;
        let trendText = '';
        let trendColor = '#95a5a6';
        let trendArrow = '→';
        if (trend > 0) {
          trendText = 'Up';
          trendColor = '#27ae60';
          trendArrow = '↑';
        } else if (trend < 0) {
          trendText = 'Down';
          trendColor = '#c0392b';
          trendArrow = '↓';
        } else {
          trendText = 'Neutral';
        }
        rows.push({
          mandi: rate.mandi,
          state: rate.state.name,
          item: item.commodity,
          rate: `${price.minrate}${price.maxrate ? '-' + price.maxrate : ''}`,
          arrival: price.arrival ? price.arrival : '',
          type: item.type || price.type || 'COMBINE',
          trend: { text: trendText, color: trendColor, arrow: trendArrow, value: trend },
          lastUpdated: price.date ? moment(price.date).format('DD/MM/YYYY\nHH:mm') : ''
        });
      }
    });
  });
  return rows;
}

// PDF export: centered, small table, header logo, watermark logo on every page, colorful professional design
exports.exportBeautifulMultiPDF = async (req, res) => {
  try {
    const { date, state } = req.query;
    const rows = await getReportRowsFull(date, state);

    const doc = new PDFDocument({ size: 'A4', margin: 0 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=mandi_report_${date || 'all'}.pdf`);
    doc.pipe(res);

    const headerBgColor = '#1e3a8a'; // Deep blue
    const headerTextColor = '#f5f5f5'; // Off-white
    const titleColor = '#1e3a8a'; // Deep blue
    const tableHeaderBg = '#3b82f6'; // Bright blue
    const tableHeaderText = '#ffffff'; // White
    const rowBgEven = '#e6f0ff'; // Light blue tint
    const rowBgOdd = '#f0f7ff'; // Slightly lighter blue tint
    const borderColor = '#93c5fd'; // Soft blue border
    const borderWidth = 0.7;

    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;
    const tableColWidths = [72, 62, 64, 66, 54, 45, 55, 68];
    const tableWidth = tableColWidths.reduce((acc, w) => acc + w, 0);
    const marginLeft = (pageWidth - tableWidth) / 2;
    const tableStartY = 90;
    const rowHeight = 20;
    const headerHeight = 28;
    const logoPath = path.join(__dirname, '../logo.png');

    function drawLogoWatermark() {
      try {
        doc.save();
        doc.opacity(0.15);
        doc.image(logoPath, (pageWidth - 280) / 2, (pageHeight - 280) / 2, { width: 280, height: 290, align: 'center' });
        doc.opacity(1);
        doc.restore();
      } catch (e) {
        console.log('Watermark logo not found or failed to load:', e);
      }
    }

    function drawHeader(title) {
      try {
        doc.image(logoPath, marginLeft - 50, 12, { width: 40, height: 40 });
      } catch (e) {
        console.log('Header logo not found or failed to load:', e);
      }
      const gradient = doc.linearGradient(0, 0, 0, 44);
      gradient.stop(0, '#1e3a8a').stop(1, '#2a5caa');
      doc.rect(0, 0, pageWidth, 44).fill(gradient);
      doc.fontSize(14).fillColor(headerTextColor).font('Helvetica-Bold')
        .text('9243019500', marginLeft, 15, { align: 'left', baseline: 'middle' });
      doc.fontSize(14).fillColor(headerTextColor).font('Helvetica-Bold')
        .text('MandiLink.ybl@gmail.com', pageWidth - marginLeft - 170, 15, { align: 'left', baseline: 'middle' });
      doc.save();
      doc.fillColor('#d1e0ff').font('Helvetica-Bold').text(title, marginLeft + 1, 49, { align: 'center', width: tableWidth });
      doc.fillColor(titleColor).font('Helvetica-Bold').text(title, marginLeft, 48, { align: 'center', width: tableWidth });
      doc.restore();
      doc.moveTo(marginLeft, 72).lineTo(marginLeft + tableWidth, 72).lineWidth(1).strokeColor('#93c5fd').stroke();
      let startY = tableStartY;
      let x = marginLeft;
      doc.fontSize(12).font('Helvetica-Bold');
      const headers = ['City/Mandi', 'State', 'Item', 'Rate', 'Arrival', 'Type', 'Trend', 'Last Updated'];
      headers.forEach((header, i) => {
        doc.rect(x, startY, tableColWidths[i], headerHeight).fill(tableHeaderBg);
        doc.strokeColor(borderColor).lineWidth(borderWidth).rect(x, startY, tableColWidths[i], headerHeight).stroke();
        doc.fillColor(tableHeaderText).text(header, x + 1, startY + 5, { width: tableColWidths[i] - 2, align: 'center' });
        x += tableColWidths[i];
      });
    }

    const rowsPerPage = Math.floor((pageHeight - tableStartY - headerHeight - 70) / rowHeight);
    let pageNum = 1;
    for (let i = 0; i < rows.length; i += rowsPerPage) {
      if (pageNum > 1) doc.addPage();
      drawLogoWatermark();
      drawHeader('DAILY MANDI REPORT ' + (date ? moment(date).format('DD/MM/YY') : moment().format('DD/MM/YY')));
      let y = tableStartY + headerHeight;
      doc.fontSize(11).font('Helvetica');
      for (let j = 0; j < rowsPerPage && (i + j) < rows.length; j++) {
        let row = rows[i + j];
        let x = marginLeft;
        const rowBg = j % 2 === 0 ? rowBgEven : rowBgOdd;
        tableColWidths.forEach((w, cidx) => {
          doc.rect(x, y, w, rowHeight).fill(rowBg);
          doc.strokeColor(borderColor).lineWidth(borderWidth).rect(x, y, w, rowHeight).stroke();
          x += w;
        });
        x = marginLeft;
        const trendDisplay = row.trend.value === 0 
          ? `${row.trend.arrow} 0` 
          : `${row.trend.arrow} ${row.trend.value > 0 ? '+' : ''}${row.trend.value}`;
        [
          row.mandi,
          row.state,
          row.item,
          row.rate,
          row.arrival,
          row.type,
          trendDisplay,
          row.lastUpdated
        ].forEach((val, cidx) => {
          doc.fillColor(cidx === 6 ? row.trend.color : '#1e3a8a');
          doc.font(cidx === 6 ? 'Helvetica-Bold' : 'Helvetica');
          doc.text(String(val).replace(/[!]/g, ''), x + 1, y + 3, { width: tableColWidths[cidx] - 2, align: 'center', height: rowHeight - 4 });
          x += tableColWidths[cidx];
        });
        y += rowHeight;
      }
      doc.fontSize(10).fillColor('#6b7280').text(`Page ${pageNum}`, pageWidth / 2, pageHeight - 30, { align: 'center' });
      pageNum += 1;
    }

    doc.end();
  } catch (err) {
    console.error('Error in exportBeautifulMultiPDF:', err);
    res.status(500).json({ error: 'Failed to export PDF' });
  }
};

// PDF export: ALL reports (latest prices)
exports.exportAllBeautifulMultiPDF = async (req, res) => {
  try {
    const rows = await getAllReportRowsFull();

    const doc = new PDFDocument({ size: 'A4', margin: 0 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=mandi_all_report.pdf`);
    doc.pipe(res);

    const headerBgColor = '#1e3a8a'; // Deep blue
    const headerTextColor = '#f5f5f5'; // Off-white
    const titleColor = '#1e3a8a'; // Deep blue
    const tableHeaderBg = '#3b82f6'; // Bright blue
    const tableHeaderText = '#ffffff'; // White
    const rowBgEven = '#e6f0ff'; // Light blue tint
    const rowBgOdd = '#f0f7ff'; // Slightly lighter blue tint
    const borderColor = '#93c5fd'; // Soft blue border
    const borderWidth = 0.7;

    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;
    const tableColWidths = [72, 62, 64, 66, 54, 45, 55, 68];
    const tableWidth = tableColWidths.reduce((acc, w) => acc + w, 0);
    const marginLeft = (pageWidth - tableWidth) / 2;
    const tableStartY = 90;
    const rowHeight = 20;
    const headerHeight = 28;
    const logoPath = path.join(__dirname, '../logo.png');

    function drawLogoWatermark() {
      try {
        doc.save();
        doc.opacity(0.15);
        doc.image(logoPath, (pageWidth - 280) / 2, (pageHeight - 280) / 2, { width: 280, height: 290, align: 'center' });
        doc.opacity(1);
        doc.restore();
      } catch (e) {
        console.log('Watermark logo not found or failed to load:', e);
      }
    }

    function drawHeader(title) {
      try {
        doc.image(logoPath, marginLeft - 50, 12, { width: 40, height: 40 });
      } catch (e) {
        console.log('Header logo not found or failed to load:', e);
      }
      const gradient = doc.linearGradient(0, 0, 0, 44);
      gradient.stop(0, '#1e3a8a').stop(1, '#2a5caa');
      doc.rect(0, 0, pageWidth, 44).fill(gradient);
      doc.fontSize(14).fillColor(headerTextColor).font('Helvetica-Bold')
        .text('9243019500', marginLeft, 15, { align: 'left', baseline: 'middle' });
      doc.fontSize(14).fillColor(headerTextColor).font('Helvetica-Bold')
        .text('MandiLink.ybl@gmail.com', pageWidth - marginLeft - 170, 15, { align: 'left', baseline: 'middle' });
      doc.save();
      doc.fillColor('#d1e0ff').font('Helvetica-Bold').text(title, marginLeft + 1, 49, { align: 'center', width: tableWidth });
      doc.fillColor(titleColor).font('Helvetica-Bold').text(title, marginLeft, 48, { align: 'center', width: tableWidth });
      doc.restore();
      doc.moveTo(marginLeft, 72).lineTo(marginLeft + tableWidth, 72).lineWidth(1).strokeColor('#93c5fd').stroke();
      let startY = tableStartY;
      let x = marginLeft;
      doc.fontSize(12).font('Helvetica-Bold');
      const headers = ['City/Mandi', 'State', 'Item', 'Rate', 'Arrival', 'Type', 'Trend', 'Last Updated'];
      headers.forEach((header, i) => {
        doc.rect(x, startY, tableColWidths[i], headerHeight).fill(tableHeaderBg);
        doc.strokeColor(borderColor).lineWidth(borderWidth).rect(x, startY, tableColWidths[i], headerHeight).stroke();
        doc.fillColor(tableHeaderText).text(header, x + 1, startY + 5, { width: tableColWidths[i] - 2, align: 'center' });
        x += tableColWidths[i];
      });
    }

    const rowsPerPage = Math.floor((pageHeight - tableStartY - headerHeight - 70) / rowHeight);
    let pageNum = 1;
    for (let i = 0; i < rows.length; i += rowsPerPage) {
      if (pageNum > 1) doc.addPage();
      drawLogoWatermark();
      drawHeader('DAILY MANDI REPORT ALL');
      let y = tableStartY + headerHeight;
      doc.fontSize(11).font('Helvetica');
      for (let j = 0; j < rowsPerPage && (i + j) < rows.length; j++) {
        let row = rows[i + j];
        let x = marginLeft;
        const rowBg = j % 2 === 0 ? rowBgEven : rowBgOdd;
        tableColWidths.forEach((w, cidx) => {
          doc.rect(x, y, w, rowHeight).fill(rowBg);
          doc.strokeColor(borderColor).lineWidth(borderWidth).rect(x, y, w, rowHeight).stroke();
          x += w;
        });
        x = marginLeft;
        const trendDisplay = row.trend.value === 0 
          ? `${row.trend.arrow} 0` 
          : `${row.trend.arrow} ${row.trend.value > 0 ? '+' : ''}${row.trend.value}`;
        [
          row.mandi,
          row.state,
          row.item,
          row.rate,
          row.arrival,
          row.type,
          trendDisplay,
          row.lastUpdated
        ].forEach((val, cidx) => {
          doc.fillColor(cidx === 6 ? row.trend.color : '#1e3a8a');
          doc.font(cidx === 6 ? 'Helvetica-Bold' : 'Helvetica');
          doc.text(String(val).replace(/[!]/g, ''), x + 1, y + 3, { width: tableColWidths[cidx] - 2, align: 'center', height: rowHeight - 4 });
          x += tableColWidths[cidx];
        });
        y += rowHeight;
      }
      doc.fontSize(10).fillColor('#6b7280').text(`Page ${pageNum}`, pageWidth / 2, pageHeight - 30, { align: 'center' });
      pageNum += 1;
    }

    doc.end();
  } catch (err) {
    console.error('Error in exportAllBeautifulMultiPDF:', err);
    res.status(500).json({ error: 'Failed to export PDF' });
  }
};

// [Remaining exports (beautifulPreview, history, reportPage, mandiratePage) remain unchanged]

// Table preview for EJS (AJAX for browser table)
exports.beautifulPreview = async (req, res) => {
  try {
    const { state, date } = req.query;
    const rows = await getReportRowsFull(date, state);
    res.json(rows);
  } catch (err) {
    console.error('Error in beautifulPreview:', err);
    res.status(500).json({ error: 'Failed to fetch preview' });
  }
};

// Price history endpoint for chart/modal (returns all prices for a mandi/commodity)
exports.history = async (req, res) => {
  try {
    const { mandi, commodity } = req.params;
    const { state } = req.query;
    let query = { mandi };
    if (state) query.state = state;
    const rate = await SabjiMandirate.findOne(query).populate('state');
    if (!rate) return res.status(404).json({ error: 'Mandi not found' });
    const item = rate.list.find(l => l.commodity === commodity);
    if (!item) return res.status(404).json({ error: 'Commodity not found' });
    res.json({
      state: rate.state.name,
      mandi: rate.mandi,
      commodity: item.commodity,
      prices: item.prices.sort((a, b) => new Date(a.date) - new Date(b.date)).map(p => ({
        date: p.date,
        minrate: p.minrate,
        maxrate: p.maxrate,
        arrival: p.arrival,
        trend: p.trend || 0
      }))
    });
  } catch (err) {
    console.error('Error in history:', err);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
};

// RENDER: Main report page (with filters, preview, PDF buttons, chart modal)
exports.reportPage = async (req, res) => {
  try {
    const states = await rajya.find().sort('name');
    res.render('report', { states });
  } catch (err) {
    console.error('Error in reportPage:', err);
    res.status(500).send('Server error');
  }
};

// RENDER: Main mandirate dashboard (if needed)
exports.mandiratePage = async (req, res) => {
  try {
    const states = await rajya.find().sort('name');
    res.render('mandirate', { states });
  } catch (err) {
    console.error('Error in mandiratePage:', err);
    res.status(500).send('Server error');
  }
};
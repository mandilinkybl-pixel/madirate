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

    // === COLORS & STYLES ===
    const bgColor = '#e8f5e9'; // Light green background
    const headerGradientTop = '#facc15'; // Bright yellow
    const headerGradientBottom = '#fcd34d'; // Soft yellow
    const headerText = '#000000';
    const tableHeaderBg = '#facc15';
    const tableHeaderText = '#000000';
    const borderColor = '#a3a3a3';
    const borderWidth = 0.6;
    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;

    const tableColWidths = [80, 80, 80, 60, 60, 60, 70];
    const tableWidth = tableColWidths.reduce((a, b) => a + b, 0);
    const marginLeft = (pageWidth - tableWidth) / 2;
    const tableStartY = 130;
    const rowHeight = 24;
    const headerHeight = 28;
    const logoPath = path.join(__dirname, '../image.png');

    // === PAGE BACKGROUND ===
    function drawPageBackground() {
      doc.save();
      doc.rect(0, 0, pageWidth, pageHeight).fill(bgColor);
      doc.restore();
    }

    // === LOGO WATERMARK ===
    function drawLogoWatermark() {
      try {
        doc.save();
        doc.opacity(0.1);
        doc.image(logoPath, (pageWidth - 300) / 2, (pageHeight - 300) / 2, { width: 300 });
        doc.opacity(1);
        doc.restore();
      } catch (err) {
        console.log('Watermark not found:', err.message);
      }
    }

    // === HEADER ===
    function drawHeader() {
      const gradient = doc.linearGradient(0, 0, 0, 80);
      gradient.stop(0, headerGradientTop).stop(1, headerGradientBottom);
      doc.rect(0, 0, pageWidth, 80).fill(gradient);

      try {
        doc.image(logoPath, 40, 10, { width: 60, height: 60 });
      } catch (e) {
        console.log('Header logo missing:', e.message);
      }

      doc.fontSize(20)
        .fillColor(headerText)
        .font('Helvetica-Bold')
        .text('MandiLink Update', 120, 28);

      // Date or "All Records"
      doc.fontSize(12)
        .fillColor(headerText)
        .text(
          date
            ? `Date: ${moment(date).format('DD/MM/YYYY')}`
            : `All Records`,
          pageWidth - 150,
          20,
          { align: 'left' }
        );

      // Divider line
      doc.moveTo(marginLeft, 90)
        .lineTo(marginLeft + tableWidth, 90)
        .strokeColor(borderColor)
        .lineWidth(1)
        .stroke();
    }

    // === TABLE HEADER ===
    function drawTableHeader() {
      let x = marginLeft;
      const headers = ['City/Mandi', 'State', 'Item', 'Rate', 'Arrival', 'Trend', 'Type'];

      headers.forEach((header, i) => {
        doc.rect(x, tableStartY, tableColWidths[i], headerHeight)
          .fill(tableHeaderBg)
          .strokeColor(borderColor)
          .lineWidth(borderWidth)
          .stroke();
        doc.fillColor(tableHeaderText)
          .font('Helvetica-Bold')
          .fontSize(11)
          .text(header, x + 2, tableStartY + 6, {
            width: tableColWidths[i] - 4,
            align: 'center'
          });
        x += tableColWidths[i];
      });
    }

    // === RESPONSIVE TEXT FUNCTION ===
    function drawCellText(text, x, y, width, height, align = 'center', bold = false, color = '#000') {
      const font = bold ? 'Helvetica-Bold' : 'Helvetica';
      doc.font(font).fontSize(10).fillColor(color);

      const safeText = String(text || '').replace(/\s+/g, ' ').trim();

      // Clip or wrap text
      let displayText = safeText;
      if (doc.widthOfString(safeText) > width - 4) {
        let truncated = '';
        for (let c of safeText) {
          if (doc.widthOfString(truncated + c) > width - 8) break;
          truncated += c;
        }
        displayText = truncated + '…';
      }

      doc.text(displayText, x + 2, y + 5, {
        width: width - 4,
        height: height - 8,
        align,
      });
    }

    // === MAIN CONTENT ===
    const rowsPerPage = Math.floor((pageHeight - tableStartY - headerHeight - 100) / rowHeight);
    let pageNum = 1;

    for (let i = 0; i < rows.length; i += rowsPerPage) {
      if (pageNum > 1) doc.addPage();

      drawPageBackground();
      drawLogoWatermark();
      drawHeader();
      drawTableHeader();

      let y = tableStartY + headerHeight;

      for (let j = 0; j < rowsPerPage && (i + j) < rows.length; j++) {
        const row = rows[i + j];
        let x = marginLeft;

        // Draw row borders
        tableColWidths.forEach((w) => {
          doc.rect(x, y, w, rowHeight)
            .strokeColor(borderColor)
            .lineWidth(borderWidth)
            .stroke();
          x += w;
        });

        // Text in cells
        const trendDisplay = `${row.trend.arrow} ${row.trend.value > 0 ? '+' : ''}${row.trend.value || 0}`;
        const rowData = [
          row.mandi,
          row.state,
          row.item,
          row.rate,
          row.arrival,
          trendDisplay,
          row.type,
        ];

        x = marginLeft;
        rowData.forEach((val, idx) => {
          const isTrend = idx === 5;
          const color = isTrend ? row.trend.color : '#000000';
          drawCellText(val, x, y, tableColWidths[idx], rowHeight, 'center', isTrend, color);
          x += tableColWidths[idx];
        });

        y += rowHeight;
      }

      // Footer page number
      doc.fontSize(10)
        .fillColor('#4b5563')
        .text(`Page ${pageNum}`, pageWidth / 2, pageHeight - 40, { align: 'center' });

      pageNum++;
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

    // === COLORS & STYLES (same as exportBeautifulMultiPDF) ===
    const bgColor = '#e8f5e9'; // light green
    const headerGradientTop = '#facc15'; // yellow top
    const headerGradientBottom = '#fcd34d'; // lighter yellow
    const headerText = '#000000';
    const tableHeaderBg = '#facc15';
    const tableHeaderText = '#000000';
    const borderColor = '#a3a3a3';
    const borderWidth = 0.6;
    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;

    const tableColWidths = [80, 80, 80, 60, 60, 60, 70];
    const tableWidth = tableColWidths.reduce((a, b) => a + b, 0);
    const marginLeft = (pageWidth - tableWidth) / 2;
    const tableStartY = 130;
    const rowHeight = 22;
    const headerHeight = 28;
    const logoPath = path.join(__dirname, '../image.png');

    // === PAGE BACKGROUND ===
    function drawPageBackground() {
      doc.save();
      doc.rect(0, 0, pageWidth, pageHeight).fill(bgColor);
      doc.restore();
    }

    // === LOGO WATERMARK (visible through transparent rows) ===
    function drawLogoWatermark() {
      try {
        doc.save();
        doc.opacity(0.08); // subtle transparency
        doc.image(logoPath, (pageWidth - 300) / 2, (pageHeight - 300) / 2, { width: 300 });
        doc.opacity(1);
        doc.restore();
      } catch (err) {
        console.log('Watermark not found:', err.message);
      }
    }

    // === HEADER ===
    function drawHeader() {
      const gradient = doc.linearGradient(0, 0, 0, 80);
      gradient.stop(0, headerGradientTop).stop(1, headerGradientBottom);
      doc.rect(0, 0, pageWidth, 80).fill(gradient);

      try {
        doc.image(logoPath, 40, 10, { width: 60, height: 60 });
      } catch (e) {
        console.log('Header logo missing:', e.message);
      }

      doc.fontSize(20)
        .fillColor(headerText)
        .font('Helvetica-Bold')
        .text('MandiLink All States Report', 120, 28);

      doc.fontSize(12)
        .fillColor(headerText)
        .text(`All States Combined`, pageWidth - 150, 20, { align: 'left' });

      doc.moveTo(marginLeft, 90)
        .lineTo(marginLeft + tableWidth, 90)
        .strokeColor(borderColor)
        .lineWidth(1)
        .stroke();
    }

    // === TABLE HEADER ===
    function drawTableHeader() {
      let x = marginLeft;
      const headers = ['City/Mandi', 'State', 'Item', 'Rate', 'Arrival', 'Trend', 'Type'];
      headers.forEach((header, i) => {
        doc.rect(x, tableStartY, tableColWidths[i], headerHeight)
          .fill(tableHeaderBg)
          .strokeColor(borderColor)
          .lineWidth(borderWidth)
          .stroke();
        doc.fillColor(tableHeaderText)
          .font('Helvetica-Bold')
          .fontSize(12)
          .text(header, x + 2, tableStartY + 6, {
            width: tableColWidths[i] - 4,
            align: 'center'
          });
        x += tableColWidths[i];
      });
    }

    // === TABLE BODY ===
    const rowsPerPage = Math.floor((pageHeight - tableStartY - headerHeight - 80) / rowHeight);
    let pageNum = 1;

    for (let i = 0; i < rows.length; i += rowsPerPage) {
      if (pageNum > 1) doc.addPage();
      drawPageBackground();
      drawLogoWatermark();
      drawHeader();
      drawTableHeader();

      let y = tableStartY + headerHeight;
      doc.fontSize(11).font('Helvetica');

      for (let j = 0; j < rowsPerPage && (i + j) < rows.length; j++) {
        const row = rows[i + j];
        let x = marginLeft;

        // Transparent row background (only borders visible)
        tableColWidths.forEach((w) => {
          doc.save();
          doc.opacity(0.2);
          doc.rect(x, y, w, rowHeight).fill('#ffffff'); // light transparent fill
          doc.restore();
          doc.strokeColor(borderColor).lineWidth(borderWidth).rect(x, y, w, rowHeight).stroke();
          x += w;
        });

        x = marginLeft;
        const trendDisplay = `${row.trend.arrow} ${row.trend.value > 0 ? '+' : ''}${row.trend.value || 0}`;

        [
          row.mandi,
          row.state,
          row.item,
          row.rate,
          row.arrival,
          trendDisplay,
          row.type,
        ].forEach((val, idx) => {
          const textColor = idx === 5 ? row.trend.color : '#000000';
          doc.fillColor(textColor)
            .font(idx === 5 ? 'Helvetica-Bold' : 'Helvetica')
            .text(String(val || ''), x + 2, y + 4, {
              width: tableColWidths[idx] - 4,
              align: 'center',
            });
          x += tableColWidths[idx];
        });

        y += rowHeight;
      }

      // Footer
      doc.fontSize(10)
        .fillColor('#4b5563')
        .text(`Page ${pageNum}`, pageWidth / 2, pageHeight - 40, { align: 'center' });

      pageNum++;
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
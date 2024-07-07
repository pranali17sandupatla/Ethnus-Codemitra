//1. Backend Task

const express = require('express');
const axios = require('axios');
const mongoose = require('mongoose');
const Transaction = require('./models/Transaction');

const app = express();
const PORT = 5000;

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/mern_challenge', { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.log(err));

// Endpoint to fetch and seed data
app.get('/api/seed', async (req, res) => {
  try {
    const response = await axios.get('https://s3.amazonaws.com/roxiler.com/product_transaction.json');
    const transactions = response.data;

    // Assuming transactions is an array of objects
    await Transaction.insertMany(transactions);
    res.json({ message: 'Database seeded successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error seeding database' });
  }
});

//2. List Transactions API
// Other APIs will be defined similarly

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));


// Example API for listing transactions based on month and search
app.get('/api/transactions', async (req, res) => {
  const { month, search = '', page = 1, perPage = 10 } = req.query;
  const regex = new RegExp(search, 'i');
  
  try {
    const transactions = await Transaction.find({
      $and: [
        { dateOfSale: { $regex: new RegExp(month, 'i') } },
        { $or: [
          { title: { $regex: regex } },
          { description: { $regex: regex } },
          { price: { $regex: regex } }
        ]}
      ]
    })
    .skip((page - 1) * perPage)
    .limit(perPage);

    res.json(transactions);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error fetching transactions' });
  }
});

//3. Statistics API
// API for statistics
app.get('/api/statistics', async (req, res) => {
  const { month } = req.query;

  try {
    const totalSaleAmount = await Transaction.aggregate([
      { $match: { dateOfSale: { $regex: new RegExp(month, 'i') } } },
      { $group: { _id: null, totalAmount: { $sum: '$price' } } }
    ]);

    const totalSoldItems = await Transaction.countDocuments({
      $and: [
        { dateOfSale: { $regex: new RegExp(month, 'i') } },
        { sold: true }
      ]
    });

    const totalNotSoldItems = await Transaction.countDocuments({
      $and: [
        { dateOfSale: { $regex: new RegExp(month, 'i') } },
        { sold: false }
      ]
    });

    res.json({
      totalSaleAmount: totalSaleAmount.length > 0 ? totalSaleAmount[0].totalAmount : 0,
      totalSoldItems,
      totalNotSoldItems
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error fetching statistics' });
  }
});

//4. Bar Chart API
// API for bar chart data
app.get('/api/bar-chart', async (req, res) => {
  const { month } = req.query;

  try {
    const barChartData = await Transaction.aggregate([
      { $match: { dateOfSale: { $regex: new RegExp(month, 'i') } } },
      {
        $group: {
          _id: {
            $switch: {
              branches: [
                { case: { $lte: ['$price', 100] }, then: '0-100' },
                { case: { $lte: ['$price', 200] }, then: '101-200' },
                { case: { $lte: ['$price', 300] }, then: '201-300' },
                { case: { $lte: ['$price', 400] }, then: '301-400' },
                { case: { $lte: ['$price', 500] }, then: '401-500' },
                { case: { $lte: ['$price', 600] }, then: '501-600' },
                { case: { $lte: ['$price', 700] }, then: '601-700' },
                { case: { $lte: ['$price', 800] }, then: '701-800' },
                { case: { $lte: ['$price', 900] }, then: '801-900' },
                { case: { $gt: ['$price', 900] }, then: '901-above' }
              ]
            }
          },
          count: { $sum: 1 }
        }
      }
    ]);

    res.json(barChartData);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error fetching bar chart data' });
  }
});

//5. Pie Chart API
// API for pie chart data
app.get('/api/pie-chart', async (req, res) => {
  const { month } = req.query;

  try {
    const pieChartData = await Transaction.aggregate([
      { $match: { dateOfSale: { $regex: new RegExp(month, 'i') } } },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 }
        }
      }
    ]);

    res.json(pieChartData.map(item => ({ [item._id]: item.count })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error fetching pie chart data' });
  }
});

//6. Combined Data API
// Combined API to fetch data from all the above APIs
app.get('/api/combined-data', async (req, res) => {
  const { month } = req.query;

  try {
    const [transactions, statistics, barChartData, pieChartData] = await Promise.all([
      axios.get(`/api/transactions?month=${month}`),
      axios.get(`/api/statistics?month=${month}`),
      axios.get(`/api/bar-chart?month=${month}`),
      axios.get(`/api/pie-chart?month=${month}`)
    ]);

    res.json({
      transactions: transactions.data,
      statistics: statistics.data,
      barChartData: barChartData.data,
      pieChartData: pieChartData.data
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error fetching combined data' });
  }
});

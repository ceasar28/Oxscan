// import { Injectable, NotFoundException } from '@nestjs/common';
// import { InjectModel } from '@nestjs/mongoose';
// import { Model } from 'mongoose';
// import {
//   Transaction,
//   TransactionDocument,
// } from 'src/database/schemas/transactions.schema';
// import { User, UserDocument } from 'src/database/schemas/user.schema';

// @Injectable()
// export class TrackerService {
//   constructor(
//     @InjectModel(Transaction.name)
//     private readonly TransactionModel: Model<TransactionDocument>,
//     @InjectModel(User.name) private readonly UserModel: Model<UserDocument>,
//   ) {}

//   async getPnlLeaderBoard(
//     chain?: string,
//     days: 'all' | '1' | '3' | '7' | '14' | '30' = 'all',
//   ): Promise<
//     {
//       name: string;
//       wallet: string;
//       twitter: string;
//       telegram: string;
//       website: string;
//       chains: string[];
//       imageUrl: string;
//       pnlSummary: {
//         totalTradesCount: number;
//         totalPnlUSD: string;
//         totalPnlPercentage: number;
//         totalBuys: number;
//         totalSells: number;
//         totalBuysUSD: string;
//         totalSellsUSD: string;
//       };
//     }[]
//   > {
//     try {
//       const users = await this.UserModel.find().exec();
//       if (!users || users.length === 0) {
//         console.log('No users found');
//         return [];
//       }

//       const defaultPnlSummary = {
//         totalTradesCount: 0,
//         totalPnlUSD: '0.00',
//         totalPnlPercentage: 0,
//         totalBuys: 0,
//         totalSells: 0,
//         totalBuysUSD: '0.00',
//         totalSellsUSD: '0.00',
//       };

//       const daysMap = { '1': 1, '3': 3, '7': 7, '14': 14, '30': 30 };
//       const dayCount = daysMap[days];
//       const timeFilter =
//         days === 'all' ? 'all' : (days as '1d' | '3d' | '7d' | '14d' | '30d');

//       const WETH_PRICE = 2000; // Placeholder, replace with actual price source

//       const pnlPromises = users.map(async (user) => {
//         const tokenAddresses = [
//           ...new Set(
//             (
//               await this.TransactionModel.find({
//                 wallet: user.wallet.toLowerCase(),
//                 chain,
//                 ...(days !== 'all' && {
//                   blockTimestamp: {
//                     $gte: new Date(Date.now() - dayCount * 24 * 60 * 60 * 1000),
//                   },
//                 }),
//               }).exec()
//             )
//               .map((tx) => [tx.tokenInAddress, tx.tokenOutAddress])
//               .flat()
//               .filter((addr): addr is string => !!addr)
//               .map((addr) => addr.toLowerCase()),
//           ),
//         ];

//         if (tokenAddresses.length === 0) {
//           return {
//             name: user.name || 'Unknown',
//             wallet: user.wallet,
//             twitter: user.twitter || '',
//             telegram: user.telegram || '',
//             website: user.website || '',
//             chains: user.chains || [],
//             imageUrl: user.imageUrl || '',
//             pnlSummary: defaultPnlSummary,
//           };
//         }

//         const tokenPnls = await this.calculateUserTokensPnl(
//           user.wallet,
//           chain,
//           tokenAddresses,
//           timeFilter,
//         );

//         const pnlSummary = tokenPnls.reduce(
//           (acc, tokenPnl) => {
//             // Ensure valid parsing with fallback to 0
//             const pnlUSD = parseFloat(tokenPnl.pnlUSD) || 0;
//             const buyAmount = parseFloat(tokenPnl.totalBuyTokenAmount) || 0;
//             const sellAmount = parseFloat(tokenPnl.totalSellTokenAmount) || 0;

//             // Assuming amounts are in ETH (adjust if in wei)
//             const buyAmountEth = buyAmount; // Remove / 1e18 if already in ETH
//             const sellAmountEth = sellAmount;

//             acc.totalTradesCount += tokenPnl.tradeCount;
//             acc.totalBuys += tokenPnl.totalBuys;
//             acc.totalSells += tokenPnl.totalSells;
//             acc.totalBuysUSD += buyAmountEth * WETH_PRICE;
//             acc.totalSellsUSD += sellAmountEth * WETH_PRICE;
//             acc.totalPnlUSD += pnlUSD;

//             return acc;
//           },
//           {
//             totalTradesCount: 0,
//             totalBuys: 0,
//             totalSells: 0,
//             totalBuysUSD: 0,
//             totalSellsUSD: 0,
//             totalPnlUSD: 0,
//             totalPnlPercentage: 0,
//           },
//         );

//         // Calculate percentage only if there’s a basis (buys USD)
//         pnlSummary.totalPnlPercentage =
//           pnlSummary.totalBuysUSD !== 0
//             ? (pnlSummary.totalPnlUSD / pnlSummary.totalBuysUSD) * 100
//             : 0;

//         // Debugging log
//         console.log(`User: ${user.wallet}, Token PNLs:`, tokenPnls);
//         console.log(
//           `User: ${user.wallet}, Aggregated PNL Summary:`,
//           pnlSummary,
//         );

//         return {
//           name: user.name || 'Unknown',
//           wallet: user.wallet,
//           twitter: user.twitter || '',
//           telegram: user.telegram || '',
//           website: user.website || '',
//           chains: user.chains || [],
//           imageUrl: user.imageUrl || '',
//           pnlSummary: {
//             totalTradesCount: pnlSummary.totalTradesCount,
//             totalPnlUSD: isNaN(pnlSummary.totalPnlUSD)
//               ? '0.00'
//               : pnlSummary.totalPnlUSD.toFixed(2),
//             totalPnlPercentage: isNaN(pnlSummary.totalPnlPercentage)
//               ? 0
//               : parseFloat(pnlSummary.totalPnlPercentage.toFixed(2)),
//             totalBuys: pnlSummary.totalBuys,
//             totalSells: pnlSummary.totalSells,
//             totalBuysUSD: isNaN(pnlSummary.totalBuysUSD)
//               ? '0.00'
//               : pnlSummary.totalBuysUSD.toFixed(2),
//             totalSellsUSD: isNaN(pnlSummary.totalSellsUSD)
//               ? '0.00'
//               : pnlSummary.totalSellsUSD.toFixed(2),
//           },
//         };
//       });

//       const leaderboard = await Promise.all(pnlPromises);
//       const filteredLeaderboard = leaderboard.filter(
//         (entry) => entry.pnlSummary.totalTradesCount > 0,
//       );

//       filteredLeaderboard.sort((a, b) => {
//         const pnlA = parseFloat(a.pnlSummary.totalPnlUSD);
//         const pnlB = parseFloat(b.pnlSummary.totalPnlUSD);
//         return pnlB - pnlA; // Descending order
//       });

//       return filteredLeaderboard;
//     } catch (error: any) {
//       console.error('Error fetching PNL leaderboard:', error.message || error);
//       throw error;
//     }
//   }
// }

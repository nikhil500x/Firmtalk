import express from 'express';
import {xchangerate} from 'xchange-rates';
import { CurrencyService, SUPPORTED_CURRENCIES } from '../services/currency.service';

const router = express.Router();

type CurrencyCode = 'INR' | 'USD' | 'EUR' | 'GBP' | 'AED' | 'JPY';

// Get supported currencies
router.get('/supported', async (req, res) => {
    try {
        const currencies = CurrencyService.getSupportedCurrencies();
        res.json({ 
            success: true,
            currencies,
            count: currencies.length
        });
    } catch (error) {
        console.error('Error fetching supported currencies:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to fetch supported currencies' 
        });
    }
});

// Get exchange rate
router.get('/rate', async (req, res) => {
    try {
        const { from, to } = req.query;

        if (!from || !to) {
            return res.status(400).json({ 
                success: false,
                error: 'Missing from or to currency' 
            });
        }

        // Validate currencies
        if (!CurrencyService.isSupportedCurrency(from as string) || !CurrencyService.isSupportedCurrency(to as string)) {
            return res.status(400).json({ 
                success: false,
                error: `Invalid currency. Supported currencies: ${SUPPORTED_CURRENCIES.join(', ')}` 
            });
        }

        if (from === to) {
            return res.json({ 
                success: true,
                rate: 1, 
                from, 
                to 
            });
        }

        const rateResult = await xchangerate(from as string, to as string);
        
        // Extract the actual rate number from the result
        const rate = typeof rateResult === 'object' && rateResult !== null && 'rate' in rateResult
            ? rateResult.rate
            : rateResult;

        res.json({ 
            success: true,
            rate, 
            from, 
            to 
        });
    } catch (error) {
        console.error('Error fetching exchange rate:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to fetch exchange rate' 
        });
    }
});

// Convert amount
router.post('/convert', async (req, res) => {
    try {
        const { amount, from, to } = req.body;

        if (!amount || !from || !to) {
            return res.status(400).json({ 
                success: false,
                error: 'Missing required fields' 
            });
        }

        // Validate currencies
        if (!CurrencyService.isSupportedCurrency(from as string) || !CurrencyService.isSupportedCurrency(to as string)) {
            return res.status(400).json({ 
                success: false,
                error: `Invalid currency. Supported currencies: ${SUPPORTED_CURRENCIES.join(', ')}` 
            });
        }

        if (from === to) {
            return res.json({
                success: true,
                amount: parseFloat(amount),
                convertedAmount: parseFloat(amount),
                rate: 1,
                from,
                to
            });
        }

        const rateResult = await xchangerate(from as string, to as string);
        
        // Extract the actual rate number from the result
        const rate = typeof rateResult === 'object' && rateResult !== null && 'rate' in rateResult
            ? rateResult.rate
            : rateResult;
            
        const convertedAmount = parseFloat(amount) * rate;

        res.json({
            success: true,
            amount: parseFloat(amount),
            convertedAmount,
            rate,
            from,
            to
        });
    } catch (error) {
        console.error('Error converting currency:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to convert currency' 
        });
    }
});

export default router;
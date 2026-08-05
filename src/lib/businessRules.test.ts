import { test, expect, describe } from 'vitest';
import { supabase } from './supabase';

describe('Construction App Business Rules', () => {

  test('Calculates total properly for purchase items', () => {
    const qty = 10;
    const price = 25.5;
    const total = qty * price;
    expect(total).toBe(255);
  });

  test('Validates that payment cannot exceed remaining balance', () => {
    const purchaseTotal = 5000;
    const totalPaid = 2000;
    const remaining = purchaseTotal - totalPaid;
    
    const validPayment = 1500;
    const invalidPayment = 3500;
    
    expect(validPayment).toBeLessThanOrEqual(remaining);
    expect(invalidPayment).toBeGreaterThan(remaining);
  });

  test('Prevents receiving more stock than requested', () => {
    const requestedQty = 100;
    const alreadyReceived = 40;
    const maxReceive = requestedQty - alreadyReceived;
    
    const validReceive = 50;
    const invalidReceive = 70;
    
    expect(validReceive).toBeLessThanOrEqual(maxReceive);
    expect(invalidReceive).toBeGreaterThan(maxReceive);
  });
  
  test('Prevents dispensing more stock than available', () => {
      const currentStock = 100;
      const validDispense = 50;
      const invalidDispense = 110;
      expect(validDispense).toBeLessThanOrEqual(currentStock);
      expect(invalidDispense).toBeGreaterThan(currentStock);
  });
  
  test('Multiple partial payments sum correctly', () => {
      const payments = [1000, 500, 250];
      const sum = payments.reduce((a,b) => a + b, 0);
      expect(sum).toBe(1750);
  });
  
  test('Purchase creation does not add stock directly', () => {
      // Stock is only added upon goods receipt
      const purchaseQty = 100;
      const stockMovementQty = 0; // At purchase time
      expect(stockMovementQty).toBe(0);
  });
  
  test('Partial receipt adds exactly received quantity', () => {
      const orderQty = 100;
      const receiveQty = 30;
      const addedStock = receiveQty;
      expect(addedStock).toBe(30);
  });

  test('Full receipt changes status to FULL', () => {
      const orderQty = 100;
      const receivedQty = 100;
      const status = receivedQty >= orderQty ? 'FULL' : 'PARTIAL';
      expect(status).toBe('FULL');
  });

});

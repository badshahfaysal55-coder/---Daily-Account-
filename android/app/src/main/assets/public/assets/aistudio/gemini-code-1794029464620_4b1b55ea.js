import React, { useState, useEffect } from 'react';
import { TextInput, View, Text } from 'react-native';
import { MMKV } from 'react-native-mmkv';

const storage = new MMKV();

export default function AccountingScreen() {
  const [amount, setAmount] = useState('');
  const [status, setStatus] = useState('Saved');

  // অটো-সেভ লজিক (Debounce সহ)
  useEffect(() => {
    if (!amount) return;

    setStatus('Saving...');
    const timer = setTimeout(() => {
      // লোকাল স্টোরেজে সেভ হচ্ছে
      storage.set('latest_account', amount);
      setStatus('All changes saved');
    }, 1000); // ইউজার টাইপ থামানোর ১ সেকেন্ড পর সেভ হবে

    return () => clearTimeout(timer);
  }, [amount]);

  return (
    <View style={{ padding: 20 }}>
      <TextInput
        placeholder="টাকার পরিমাণ লিখুন"
        value={amount}
        onChangeText={setAmount}
        keyboardType="numeric"
        style={{ borderWidth: 1, padding: 10, marginBottom: 10 }}
      />
      <Text style={{ color: 'gray' }}>{status}</Text>
    </View>
  );
}
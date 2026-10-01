import { useState } from 'react';
import {
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';

const TENDER_DATA = {
  "Yallappa TR": [
    { lotNo: "L0001", price: 8000, bags: 17 },
    { lotNo: "L0002", price: 7800, bags: 10 },
    { lotNo: "L0003", price: 8250, bags: 22 },
  ],
  "Ramesh TR": [
    { lotNo: "L0004", price: 7500, bags: 12 },
    { lotNo: "L0005", price: 7900, bags: 15 },
  ]
};

export default function App() {
  const [caName] = useState("Nitin CA");
  const [selectedTrader, setSelectedTrader] = useState("Yallappa TR");
  const [selectedLot, setSelectedLot] = useState(TENDER_DATA["Yallappa TR"][0]);
  const [bagData, setBagData] = useState({});

  const handleTraderChange = (trader) => {
    setSelectedTrader(trader);
    const firstLot = TENDER_DATA[trader][0];
    setSelectedLot(firstLot);
    setBagData({});
  };

  const handleLotChange = (lot) => {
    setSelectedLot(lot);
    setBagData({});
  };

  const handleBagInputChange = (bagNum, field, value) => {
    setBagData(prev => ({
      ...prev,
      [bagNum]: {
        ...(prev[bagNum] || { total: '', less: '', net: '' }),
        [field]: value
      }
    }));
  };

  const renderBagGridRows = (fieldKey, labelTitle) => {
    let boxes = [];
    for (let i = 1; i <= selectedLot.bags; i++) {
      const currentValue = bagData[i]?.[fieldKey] || '';
      boxes.push(
        <View key={`${fieldKey}-b${i}`} style={styles.bagBoxContainer}>
          <Text style={styles.bagLabel}>B{i}</Text>
          <TextInput
            style={styles.bagInput}
            keyboardType="numeric"
            value={currentValue}
            onChangeText={(text) => handleBagInputChange(i, fieldKey, text)}
            placeholder="0"
            placeholderTe
            xtColor="#999"
          />
        </View>
      );
    }
    return (
      <View style={styles.gridRowGroup}>
        <Text style={styles.rowTitle}>{labelTitle}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalGrid}>
          {boxes}
        </ScrollView>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.headerTitle}>Market Lot Weighment</Text>
      
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.formTable}>
          <View style={styles.row}>
            <Text style={styles.label}>Date</Text>
            <Text style={styles.valueText}>29 Sept 2026</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>CA Name</Text>
            <Text style={styles.valueTextDisabled}>{caName} (Non editable)</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Trader Name</Text>
            <View style={styles.pillContainer}>
              {Object.keys(TENDER_DATA).map(trader => (
                <TouchableOpacity 
                  key={trader} 
                  style={[styles.pill, selectedTrader === trader && styles.activePill]}
                  onPress={() => handleTraderChange(trader)}
                >
                  <Text style={[styles.pillText, selectedTrader === trader && styles.activePillText]}>
                    {trader}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Lot Number</Text>
            <View style={styles.pillContainer}>
              {TENDER_DATA[selectedTrader].map(lot => (
                <TouchableOpacity 
                  key={lot.lotNo} 
                  style={[styles.pill, selectedLot.lotNo === lot.lotNo && styles.activePill]}
                  onPress={() => handleLotChange(lot)}
                >
                  <Text style={[styles.pillText, selectedLot.lotNo === lot.lotNo && styles.activePillText]}>
                    {lot.lotNo}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Price</Text>
            <Text style={styles.valueHighlight}>₹ {selectedLot.price}</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Bag Count</Text>
            <Text style={styles.valueHighlight}>{selectedLot.bags} Bags</Text>
          </View>
        </View>

        <View style={styles.matrixContainer}>
          <Text style={styles.matrixHeader}>
            Bag-wise Quantity Matrix ({selectedLot.bags} Boxes Generated)
          </Text>
          
          {renderBagGridRows('total', 'Total Qty')}
          {renderBagGridRows('less', 'Less Qty')}
          {renderBagGridRows('net', 'Net Qty')}
        </View>

        <TouchableOpacity style={styles.saveButton} onPress={() => alert('Data Saved Successfully!')}>
          <Text style={styles.saveButtonText}>Save Lot Entry</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f6fa', paddingTop: 40 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', textAlign: 'center', marginVertical: 12, color: '#2f3640' },
  scrollContent: { padding: 16 },
  formTable: { backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#dcdde1', marginBottom: 20 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 15, borderBottomWidth: 1, borderBottomColor: '#f1f2f6' },
  label: { fontWeight: '600', color: '#353b48', flex: 1 },
  valueText: { color: '#2f3640', fontWeight: '500' },
  valueTextDisabled: { color: '#718093', fontStyle: 'italic' },
  valueHighlight: { color: '#009432', fontWeight: 'bold', fontSize: 16 },
  pillContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, flex: 2, justifyContent: 'flex-end' },
  pill: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6, backgroundColor: '#f1f2f6', borderWidth: 1, borderColor: '#dcdde1' },
  activePill: { backgroundColor: '#0984e3', borderColor: '#0984e3' },
  pillText: { fontSize: 12, color: '#2f3640' },
  activePillText: { color: '#fff', fontWeight: 'bold' },
  matrixContainer: { backgroundColor: '#fff', borderRadius: 8, padding: 15, borderWidth: 1, borderColor: '#dcdde1', marginBottom: 20 },
  matrixHeader: { fontSize: 14, fontWeight: 'bold', color: '#2f3640', marginBottom: 12 },
  gridRowGroup: { marginBottom: 15 },
  rowTitle: { fontSize: 13, fontWeight: '600', color: '#718093', marginBottom: 6 },
  horizontalGrid: { gap: 8, paddingVertical: 4 },
  bagBoxContainer: { width: 60, backgroundColor: '#f8f9fa', borderRadius: 6, borderWidth: 1, borderColor: '#ced6e0', alignItems: 'center', padding: 6 },
  bagLabel: { fontSize: 11, fontWeight: 'bold', color: '#57606f', marginBottom: 4 },
  bagInput: { width: '100%', height: 32, backgroundColor: '#fff', borderWidth: 1, borderColor: '#dcdde1', borderRadius: 4, textAlign: 'center', fontSize: 12, color: '#2f3640' },
  saveButton: { backgroundColor: '#00b894', paddingVertical: 14, borderRadius: 8, alignItems: 'center', marginBottom: 30 },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
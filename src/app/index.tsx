import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Print from 'expo-print';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import * as XLSX from 'xlsx';

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun", 
  "Jul", "Aug", "Sept", "Oct", "Nov", "Dec"
];

function parseBillDate(dateStr: string): number {
  if (!dateStr) return 0;
  const clean = dateStr.trim();
  const parts = clean.split(/[\s-]+/);
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10);
    const monthStr = parts[1].toLowerCase();
    const year = parseInt(parts[2], 10);
    const monthIdx = MONTH_NAMES.findIndex(m => m.toLowerCase().startsWith(monthStr.slice(0, 3)));
    if (!isNaN(day) && monthIdx !== -1 && !isNaN(year)) {
      return new Date(year, monthIdx, day).getTime();
    }
  }
  const fallback = new Date(clean).getTime();
  return isNaN(fallback) ? 0 : fallback;
}

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [loginError, setLoginError] = useState("");
  const correctPassword = "1234";

  const handleLogin = () => {
    if (passwordInput === correctPassword) {
      setIsLoggedIn(true);
      setLoginError("");
      setPasswordInput("");
    } else {
      setLoginError("❌ Incorrect password. Please try again.");
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setPasswordInput("");
  };

  const [activeTab, setActiveTab] = useState('entry');
  const [caName] = useState("Nitin CA");
  const [currentDate, setItemsDate] = useState("29 Sept 2026");

  // Date filter selections & Commodity filter for Saved Bills tab
  const [fromDateStr, setFromDateStr] = useState("");
  const [toDateStr, setToDateStr] = useState("");
  const [filterCommodity, setFilterCommodity] = useState("All");

  // Custom Calendar Modal state
  const [calendarTarget, setCalendarTarget] = useState<'from' | 'to' | null>(null);
  const today = new Date();
  const [pickerYear, setPickerYear] = useState(today.getFullYear());
  const [pickerMonth, setPickerMonth] = useState(today.getMonth());
  const [commodityFilterModalVisible, setCommodityFilterModalVisible] = useState(false);

  // Local Tender Database
  const [tenderDatabase, setTenderDatabase] = useState<Record<string, any[]>>({
    "NITIN": [
      { lotNo: "L0001", commodity: "Paddy", price: 8000, bags: 5, date: "29 Sept 2026" }
    ]
  });

  const [selectedTrader, setSelectedTrader] = useState("");
  const [selectedCommodity, setSelectedCommodity] = useState("");
  const [selectedLot, setSelectedLot] = useState<any>(null);
  const [lessQty, setLessQty] = useState("0");
  const [bagWeights, setBagWeights] = useState<Record<number, string>>({});
  const [savedBills, setSavedBills] = useState<any[]>([]);

  const [traderModalVisible, setTraderModalVisible] = useState(false);
  const [commodityModalVisible, setCommodityModalVisible] = useState(false);
  const [lotModalVisible, setLotModalVisible] = useState(false);

  const inputRefs = useRef<any>({});

  useEffect(() => {
    if (Platform.OS === 'web') {
      try {
        const storedBills = localStorage.getItem('nitin_saved_bills');
        if (storedBills) setSavedBills(JSON.parse(storedBills));
      } catch (e) {
        console.error("Local storage load failed", e);
      }
    }
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web') {
      try {
        localStorage.setItem('nitin_saved_bills', JSON.stringify(savedBills));
      } catch (e) {
        console.error("Local storage save failed", e);
      }
    }
  }, [savedBills]);

  const formatExcelDate = (val: any) => {
    if (!val) return "29 Sept 2026";
    if (typeof val === 'number') {
      const excelEpoch = new Date(1899, 11, 30);
      const d = new Date(excelEpoch.getTime() + val * 86400000);
      return `${String(d.getDate()).padStart(2, '0')} ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
    }
    if (typeof val === 'string') {
      const trimmed = val.trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
        const parts = trimmed.split('-');
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        const d = parseInt(parts[2], 10);
        const dateObj = new Date(y, m, d);
        if (!isNaN(dateObj.getTime())) {
          return `${String(dateObj.getDate()).padStart(2, '0')} ${MONTH_NAMES[dateObj.getMonth()]} ${dateObj.getFullYear()}`;
        }
      }
    }
    return String(val);
  };

  const handleExcelImport = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel', 'text/csv', '*/*'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const fileUri = result.assets[0].uri;
        let workbook;

        if (Platform.OS === 'web') {
          const response = await fetch(fileUri);
          const fileData = await response.arrayBuffer();
          workbook = XLSX.read(fileData, { type: 'array' });
        } else {
          const base64Data = await FileSystem.readAsStringAsync(fileUri, {
            encoding: FileSystem.EncodingType.Base64,
          });
          workbook = XLSX.read(base64Data, { type: 'base64' });
        }

        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rawJsonData: any[] = XLSX.utils.sheet_to_json(worksheet);

        if (rawJsonData.length > 0) {
          let newDb: Record<string, any[]> = {};
          let importedDate = "";

          rawJsonData.forEach(row => {
            let cleanRow: any = {};
            Object.keys(row).forEach(k => {
              cleanRow[k.trim().toLowerCase()] = row[k];
            });

            const trader = String(cleanRow['trader name'] || cleanRow['tradername'] || cleanRow['trader'] || 'Unknown Trader').trim();
            const commodity = String(cleanRow['commodity'] || cleanRow['item'] || cleanRow['goods'] || 'General').trim();
            const lotNo = String(cleanRow['lot number'] || cleanRow['lotnumber'] || cleanRow['lot'] || cleanRow['lotno'] || 'L-001').trim();
            const price = parseFloat(cleanRow['price']) || 0;
            const bags = parseInt(cleanRow['bag count'] || cleanRow['bagcount'] || cleanRow['bags'], 10) || 1;
            const formattedDate = formatExcelDate(cleanRow['date']);

            if (!importedDate && formattedDate) importedDate = formattedDate;
            if (!newDb[trader]) newDb[trader] = [];
            newDb[trader].push({ lotNo, commodity, price, bags, date: formattedDate });
          });

          setTenderDatabase(newDb);
          if (importedDate) setItemsDate(importedDate);
          setSelectedTrader("");
          setSelectedCommodity("");
          setSelectedLot(null);
          setBagWeights({});
          setLessQty("0");
          alert("Excel file successfully imported and updated!");
        } else {
          alert("The imported file is empty.");
        }
      }
    } catch (error) {
      console.error("Import error:", error);
      alert("Error reading file.");
    }
  };

  const handleSelectTrader = (trader: string) => {
    setSelectedTrader(trader);
    setSelectedCommodity("");
    setSelectedLot(null);
    setBagWeights({});
    const traderLots = tenderDatabase[trader];
    if (traderLots && traderLots.length > 0 && traderLots[0].date) {
      setItemsDate(traderLots[0].date);
    }
    setTraderModalVisible(false);
  };

  const handleSelectCommodity = (comm: string) => {
    setSelectedCommodity(comm);
    setSelectedLot(null);
    setBagWeights({});
    setCommodityModalVisible(false);
  };

  const handleSelectLot = (lot: any) => {
    const isAlreadySaved = savedBills.some(b => 
      b.trader === selectedTrader && 
      b.commodity === selectedCommodity && 
      b.lotNo === lot.lotNo &&
      b.date === currentDate
    );
    if (isAlreadySaved) {
      alert("This lot has already been saved and is frozen.");
      return;
    }
    setSelectedLot(lot);
    if (lot.date) setItemsDate(lot.date);
    setBagWeights({});
    setLotModalVisible(false);
  };

  const handleBagWeightChange = (bagNum: number, val: string) => {
    setBagWeights(prev => ({ ...prev, [bagNum]: val }));
  };

  const handleKeyPressNext = (currentBagIndex: number, totalBags: number) => {
    if (currentBagIndex < totalBags) {
      const nextInput = inputRefs.current[currentBagIndex + 1];
      if (nextInput) nextInput.focus();
    }
  };

  const totalBagsCount = selectedLot ? selectedLot.bags : 0;
  let totalQty = 0;
  for (let i = 1; i <= totalBagsCount; i++) {
    totalQty += parseFloat(bagWeights[i]) || 0;
  }
  const lessQtyNum = parseFloat(lessQty) || 0;
  const netQty = Math.max(0, totalQty - lessQtyNum);
  const priceNum = selectedLot ? selectedLot.price : 0;
  const totalAmount = (netQty * priceNum) / 100;

  const handleReset = () => {
    const performReset = () => {
      setSelectedTrader("");
      setSelectedCommodity("");
      setSelectedLot(null);
      setLessQty("0");
      setBagWeights({});
      if (Platform.OS === 'web') alert("Reset successfully completed!");
    };

    if (Platform.OS === 'web') {
      if (window.confirm("Are you sure you want to reset current entries?")) performReset();
    } else {
      Alert.alert("Confirm Reset", "Are you sure you want to reset current entries?", [
        { text: "Cancel", style: "cancel" },
        { text: "Reset", style: "destructive", onPress: performReset }
      ]);
    }
  };

  const handleSaveBill = () => {
    if (!selectedTrader || !selectedCommodity || !selectedLot) {
      alert("Please select a Trader, Commodity, and Lot before saving.");
      return;
    }
    const isAlreadySaved = savedBills.some(b => 
      b.trader === selectedTrader && 
      b.commodity === selectedCommodity && 
      b.lotNo === selectedLot.lotNo &&
      b.date === currentDate
    );
    if (isAlreadySaved) {
      alert("Error: This lot is already saved!");
      return;
    }

    let currentBagWeightsObj: Record<string, string> = {};
    for (let i = 1; i <= totalBagsCount; i++) {
      currentBagWeightsObj[`B${i}`] = bagWeights[i] || "0";
    }

    const newBill = {
      id: Date.now().toString(),
      date: currentDate,
      caName,
      trader: selectedTrader,
      commodity: selectedCommodity,
      lotNo: selectedLot.lotNo,
      bags: totalBagsCount,
      bagWeights: currentBagWeightsObj,
      totalQty: totalQty.toFixed(2),
      lessQty: lessQtyNum,
      netQty: netQty.toFixed(2),
      amount: totalAmount.toFixed(2),
      price: priceNum,
      createdAt: Date.now()
    };

    setSavedBills(prev => [newBill, ...prev]);
    setSelectedTrader("");
    setSelectedCommodity("");
    setSelectedLot(null);
    setLessQty("0");
    setBagWeights({});
    alert("Saved Successfully!");
  };

  const triggerPrint = (htmlContent: string) => {
    if (Platform.OS === 'web') {
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(htmlContent);
        printWindow.document.close();
      }
    } else {
      Print.printAsync({ html: htmlContent });
    }
  };

  const handlePrintCurrent = () => {
    if (!selectedTrader || !selectedCommodity || !selectedLot) {
      alert("Please select a Trader, Commodity, and Lot before printing.");
      return;
    }
    let bagsHtml = '';
    for (let i = 1; i <= totalBagsCount; i++) {
      bagsHtml += `<div class="bag-item"><strong>B${i}:</strong> ${bagWeights[i] || '0'} kg</div>`;
    }
    const htmlContent = `
      <html>
        <head>
          <title>Aada Bill - ${selectedTrader} (${selectedLot.lotNo})</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; color: #333; }
            .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 15px; }
            .row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px; }
            .box { border: 1px solid #ccc; padding: 15px; border-radius: 6px; }
            .bags-grid { display: flex; flex-wrap: wrap; gap: 6px; margin: 10px 0; }
            .bag-item { border: 1px solid #0984e3; padding: 4px 8px; border-radius: 4px; font-size: 12px; }
            .total { font-size: 16px; color: #00b894; font-weight: bold; margin-top: 15px; border-top: 1px dashed #ccc; padding-top: 10px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>AADA BILL / PATTI</h2>
            <p>Date: ${currentDate} | CA: ${caName}</p>
          </div>
          <div class="box">
            <div class="row"><strong>Trader:</strong> <span>${selectedTrader}</span></div>
            <div class="row"><strong>Commodity:</strong> <span>${selectedCommodity}</span></div>
            <div class="row"><strong>Lot Number:</strong> <span>${selectedLot.lotNo}</span></div>
            <div class="row"><strong>Price:</strong> <span>Rs ${selectedLot.price}</span></div>
            <div class="row"><strong>Bags:</strong> <span>${totalBagsCount}</span></div>
            <div class="bags-grid">${bagsHtml}</div>
            <div class="row"><strong>Total Qty:</strong> <span>${totalQty.toFixed(2)} kg</span></div>
            <div class="row"><strong>Less Qty:</strong> <span>${lessQtyNum} kg</span></div>
            <div class="row"><strong>Net Qty:</strong> <span>${netQty.toFixed(2)} kg</span></div>
            <div class="row total"><span>Total Amount:</span> <span>Rs ${totalAmount.toFixed(2)}</span></div>
          </div>
          <script>window.onload = function() { window.print(); }</script>
        </body>
      </html>
    `;
    triggerPrint(htmlContent);
  };

  const handleReprintBill = (bill: any) => {
    let savedBagsHtml = '';
    if (bill.bagWeights) {
      Object.keys(bill.bagWeights).forEach(bagKey => {
        savedBagsHtml += `<div class="bag-item"><strong>${bagKey}:</strong> ${bill.bagWeights[bagKey]} kg</div>`;
      });
    }
    const htmlContent = `
      <html>
        <head>
          <title>Aada Bill - ${bill.trader} (${bill.lotNo})</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; color: #333; }
            .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 15px; }
            .row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px; }
            .box { border: 1px solid #ccc; padding: 15px; border-radius: 6px; }
            .bags-grid { display: flex; flex-wrap: wrap; gap: 6px; margin: 10px 0; }
            .bag-item { border: 1px solid #0984e3; padding: 4px 8px; border-radius: 4px; font-size: 12px; }
            .total { font-size: 16px; color: #00b894; font-weight: bold; margin-top: 15px; border-top: 1px dashed #ccc; padding-top: 10px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>AADA BILL / PATTI (REPRINT)</h2>
            <p>Date: ${bill.date} | CA: ${bill.caName}</p>
          </div>
          <div class="box">
            <div class="row"><strong>Trader:</strong> <span>${bill.trader}</span></div>
            <div class="row"><strong>Commodity:</strong> <span>${bill.commodity || 'N/A'}</span></div>
            <div class="row"><strong>Lot Number:</strong> <span>${bill.lotNo}</span></div>
            <div class="row"><strong>Price:</strong> <span>Rs ${bill.price}</span></div>
            <div class="row"><strong>Bags:</strong> <span>${bill.bags}</span></div>
            <div class="bags-grid">${savedBagsHtml}</div>
            <div class="row"><strong>Total Qty:</strong> <span>${bill.totalQty} kg</span></div>
            <div class="row"><strong>Less Qty:</strong> <span>${bill.lessQty} kg</span></div>
            <div class="row"><strong>Net Qty:</strong> <span>${bill.netQty} kg</span></div>
            <div class="row total"><span>Total Amount:</span> <span>Rs ${bill.amount}</span></div>
          </div>
          <script>window.onload = function() { window.print(); }</script>
        </body>
      </html>
    `;
    triggerPrint(htmlContent);
  };

  const filteredSavedBills = savedBills.filter(bill => {
    if (filterCommodity !== "All" && (bill.commodity || "General") !== filterCommodity) {
      return false;
    }
    if (!fromDateStr && !toDateStr) return true;
    const billTimestamp = parseBillDate(bill.date);
    if (!billTimestamp) return true;

    const fromTimestamp = fromDateStr ? parseBillDate(fromDateStr) : null;
    const toTimestamp = toDateStr ? parseBillDate(toDateStr) + 86400000 : null;

    if (fromTimestamp && billTimestamp < fromTimestamp) return false;
    if (toTimestamp && billTimestamp > toTimestamp) return false;
    return true;
  });

  // Export filtered saved bills to Excel with summary columns positioned AFTER bag weights B1, B2...
  const handleExportExcel = () => {
    if (filteredSavedBills.length === 0) {
      alert("No bills available to export for the selected filter.");
      return;
    }

    const exportData = filteredSavedBills.map((b, index) => {
      let rowObj: Record<string, any> = {
        "Sl No": index + 1,
        "Date": b.date,
        "CA Name": b.caName,
        "Trader Name": b.trader,
        "Commodity": b.commodity || "",
        "Lot Number": b.lotNo,
        "Total Bags": b.bags
      };

      // 1. Insert individual bag weight columns (B1, B2, B3...) right after Total Bags
      if (b.bagWeights) {
        Object.keys(b.bagWeights).forEach(bagKey => {
          rowObj[bagKey] = b.bagWeights[bagKey];
        });
      }

      // 2. Append Total Qty, Less Qty, Net Qty, Price, and Total Amount at the VERY END
      rowObj["Total Qty (kg)"] = b.totalQty;
      rowObj["Less Qty (kg)"] = b.lessQty;
      rowObj["Net Qty (kg)"] = b.netQty;
      rowObj["Price (Rs)"] = b.price;
      rowObj["Total Amount (Rs)"] = b.amount;

      return rowObj;
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Saved Bills");
    XLSX.writeFile(workbook, `Saved_Bills_${Date.now()}.xlsx`);
  };

  const handleSelectDay = (day: number) => {
    const formatted = `${String(day).padStart(2, '0')} ${MONTH_NAMES[pickerMonth]} ${pickerYear}`;
    if (calendarTarget === 'from') {
      setFromDateStr(formatted);
    } else if (calendarTarget === 'to') {
      setToDateStr(formatted);
    }
    setCalendarTarget(null);
  };

  const renderBagGrid = () => {
    if (!selectedLot) return null;
    let boxes = [];
    for (let i = 1; i <= selectedLot.bags; i++) {
      boxes.push(
        <View key={i} style={styles.bagBox}>
          <Text style={styles.bagBoxTitle}>B{i}</Text>
          <TextInput
            ref={el => inputRefs.current[i] = el}
            style={styles.bagBoxInput}
            keyboardType="numeric"
            returnKeyType={i === selectedLot.bags ? "done" : "next"}
            onSubmitEditing={() => handleKeyPressNext(i, selectedLot.bags)}
            blurOnSubmit={false}
            value={bagWeights[i] !== undefined ? String(bagWeights[i]) : ""}
            onChangeText={(text) => handleBagWeightChange(i, text)}
            placeholder="0"
            placeholderTextColor="#b2bec3"
          />
        </View>
      );
    }
    return <View style={styles.gridContainer}>{boxes}</View>;
  };

  if (!isLoggedIn) {
    return (
      <SafeAreaView style={styles.loginContainer}>
        <View style={styles.loginCard}>
          <Text style={styles.loginTitle}>🔒 Tuka Entry Login</Text>
          <Text style={styles.loginSubLabel}>Enter Password to Continue</Text>
          <TextInput
            style={styles.loginInput}
            secureTextEntry
            placeholder="Enter Password (e.g. 1234)"
            placeholderTextColor="#b2bec3"
            value={passwordInput}
            onChangeText={setPasswordInput}
            returnKeyType="done"
            onSubmitEditing={handleLogin}
          />
          {loginError ? <Text style={styles.errorText}>{loginError}</Text> : null}
          <TouchableOpacity style={styles.loginBtn} onPress={handleLogin}>
            <Text style={styles.loginBtnText}>Login</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const daysInCurrentPickerMonth = new Date(pickerYear, pickerMonth + 1, 0).getDate();
  const firstDayOfMonth = new Date(pickerYear, pickerMonth, 1).getDay();
  const allAvailableCommodities = Array.from(new Set(savedBills.map(b => b.commodity || "General")));

  return (
    <SafeAreaView style={styles.container}>
      
      {/* Top Header Bar */}
      <View style={styles.tabHeader}>
        <TouchableOpacity 
          style={[styles.tabButton, activeTab === 'entry' && styles.activeTabButton]}
          onPress={() => setActiveTab('entry')}
        >
          <Text style={[styles.tabText, activeTab === 'entry' && styles.activeTabText]}>Tuka Entry</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.tabButton, activeTab === 'saved' && styles.activeTabButton]}
          onPress={() => setActiveTab('saved')}
        >
          <Text style={[styles.tabText, activeTab === 'saved' && styles.activeTabText]}>
            Saved Bills / Reprint ({savedBills.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.topImportBtn} onPress={handleExcelImport}>
          <Text style={styles.topImportBtnText}>📁 Import Option</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.lockCornerBtn} onPress={handleLogout}>
          <Text style={styles.lockCornerBtnText}>🔒 Lock</Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'entry' ? (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.card}>
            <View style={styles.rowBetween}>
              <View>
                <Text style={styles.subLabel}>Date</Text>
                <Text style={styles.mainValue}>{currentDate}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.subLabel}>CA Name</Text>
                <Text style={styles.mainValue}>{caName}</Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.dropdownRow}>
              <View style={{ flex: 1, marginRight: 6 }}>
                <Text style={styles.subLabel}>Select Trader</Text>
                <TouchableOpacity style={styles.dropdownSelector} onPress={() => setTraderModalVisible(true)}>
                  <Text style={styles.dropdownText} numberOfLines={1}>{selectedTrader || "Trader"}</Text>
                  <Text style={styles.dropdownArrow}>▼</Text>
                </TouchableOpacity>
              </View>

              <View style={{ flex: 1, marginHorizontal: 3 }}>
                <Text style={styles.subLabel}>Commodity</Text>
                <TouchableOpacity 
                  style={styles.dropdownSelector} 
                  onPress={() => { if (selectedTrader) setCommodityModalVisible(true); }}
                >
                  <Text style={styles.dropdownText} numberOfLines={1}>{selectedCommodity || "Commodity"}</Text>
                  <Text style={styles.dropdownArrow}>▼</Text>
                </TouchableOpacity>
              </View>

              <View style={{ flex: 1, marginLeft: 6 }}>
                <Text style={styles.subLabel}>Select Lot</Text>
                <TouchableOpacity 
                  style={styles.dropdownSelector} 
                  onPress={() => { if (selectedTrader && selectedCommodity) setLotModalVisible(true); }}
                >
                  <Text style={styles.dropdownText} numberOfLines={1}>{selectedLot ? `${selectedLot.lotNo}` : "Lot"}</Text>
                  <Text style={styles.dropdownArrow}>▼</Text>
                </TouchableOpacity>
              </View>
            </View>

            {selectedLot && (
              <View style={styles.priceBagBanner}>
                <Text style={styles.bannerText}>Price: <Text style={styles.bannerHighlight}>Rs {selectedLot.price}</Text></Text>
                <Text style={styles.bannerText}>Bags: <Text style={styles.bannerHighlight}>{selectedLot.bags}</Text></Text>
              </View>
            )}

            {renderBagGrid()}

            <View style={styles.divider} />

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total Qty:</Text>
              <Text style={styles.summaryValue}>{totalQty.toFixed(2)} kg</Text>
            </View>

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Less Qty (Bardana):</Text>
              <TextInput
                style={styles.lessInput}
                keyboardType="numeric"
                returnKeyType="done"
                value={lessQty}
                onChangeText={setLessQty}
                placeholder="0"
                placeholderTextColor="#b2bec3"
              />
            </View>

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabelNet}>Net Qty:</Text>
              <Text style={styles.summaryValueNet}>{netQty.toFixed(2)} kg</Text>
            </View>

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabelAmount}>Total Amount:</Text>
              <Text style={styles.summaryValueAmount}>Rs {totalAmount.toFixed(2)}</Text>
            </View>
          </View>

          <View style={styles.actionButtonsRow}>
            <TouchableOpacity style={styles.resetBtn} onPress={handleReset}>
              <Text style={styles.resetBtnText}>Reset</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.printBtn} onPress={handlePrintCurrent}>
              <Text style={styles.printBtnText}>🖨 Print</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.saveBtn} onPress={handleSaveBill}>
              <Text style={styles.saveBtnText}>Save</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Text style={styles.sectionHeader}>Saved Aada Bill-gala Patti (Re-print Maadalu):</Text>
          
          <View style={styles.dateFilterContainer}>
            <View style={styles.filterRowTop}>
              <View style={{ flex: 1, marginRight: 6 }}>
                <Text style={styles.subLabel}>From Date</Text>
                <TouchableOpacity style={styles.calendarBox} onPress={() => setCalendarTarget('from')}>
                  <Text style={[styles.calendarBoxText, !fromDateStr && styles.placeholderText]}>
                    {fromDateStr || "From Date"}
                  </Text>
                  <Text style={styles.calendarIcon}>📅</Text>
                </TouchableOpacity>
              </View>

              <View style={{ flex: 1, marginLeft: 6 }}>
                <Text style={styles.subLabel}>To Date</Text>
                <TouchableOpacity style={styles.calendarBox} onPress={() => setCalendarTarget('to')}>
                  <Text style={[styles.calendarBoxText, !toDateStr && styles.placeholderText]}>
                    {toDateStr || "To Date"}
                  </Text>
                  <Text style={styles.calendarIcon}>📅</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.filterRowBottom}>
              <View style={{ flex: 1, marginRight: 6, marginTop: 8 }}>
                <Text style={styles.subLabel}>Commodity</Text>
                <TouchableOpacity style={styles.calendarBox} onPress={() => setCommodityFilterModalVisible(true)}>
                  <Text style={styles.calendarBoxText} numberOfLines={1}>{filterCommodity}</Text>
                  <Text style={styles.dropdownArrow}>▼</Text>
                </TouchableOpacity>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginTop: 8 }}>
                {(fromDateStr || toDateStr || filterCommodity !== "All") && (
                  <TouchableOpacity 
                    style={styles.clearDateBtn} 
                    onPress={() => { setFromDateStr(""); setToDateStr(""); setFilterCommodity("All"); }}
                  >
                    <Text style={styles.clearDateBtnText}>Clear</Text>
                  </TouchableOpacity>
                )}
                
                <TouchableOpacity style={styles.exportExcelBtn} onPress={handleExportExcel}>
                  <Text style={styles.exportExcelBtnText}>📥 Export Excel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {filteredSavedBills.length === 0 ? (
            <Text style={styles.noBillsText}>No saved bills found for selected filters.</Text>
          ) : (
            filteredSavedBills.map((bill) => (
              <View key={bill.id} style={styles.savedBillCard}>
                <View>
                  <Text style={styles.savedBillTitle}>{bill.trader} - {bill.commodity || ''} ({bill.lotNo})</Text>
                  <Text style={styles.savedBillSub}>{bill.bags} Bags | Net: {bill.netQty} kg | Amount: Rs {bill.amount}</Text>
                  <Text style={styles.savedBillDate}>{bill.date} | {bill.caName}</Text>
                </View>
                <TouchableOpacity style={styles.reprintBtn} onPress={() => handleReprintBill(bill)}>
                  <Text style={styles.reprintBtnText}>Re-Print</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </ScrollView>
      )}

      {/* POPUP CALENDAR MODAL */}
      <Modal visible={calendarTarget !== null} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.calendarModalContent}>
            <View style={styles.calNavHeader}>
              <TouchableOpacity 
                style={styles.calNavBtn} 
                onPress={() => {
                  if (pickerMonth === 0) {
                    setPickerMonth(11);
                    setPickerYear(prev => prev - 1);
                  } else {
                    setPickerMonth(prev => prev - 1);
                  }
                }}
              >
                <Text style={styles.calNavBtnText}>◀</Text>
              </TouchableOpacity>

              <Text style={styles.calNavTitle}>
                {MONTH_NAMES[pickerMonth]} {pickerYear}
              </Text>

              <TouchableOpacity 
                style={[
                  styles.calNavBtn, 
                  (pickerYear >= today.getFullYear() && pickerMonth >= today.getMonth()) && styles.disabledCalNav
                ]} 
                disabled={pickerYear >= today.getFullYear() && pickerMonth >= today.getMonth()}
                onPress={() => {
                  if (pickerMonth === 11) {
                    setPickerMonth(0);
                    setPickerYear(prev => prev + 1);
                  } else {
                    setPickerMonth(prev => prev + 1);
                  }
                }}
              >
                <Text style={styles.calNavBtnText}>▶</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.calWeekRow}>
              {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map(day => (
                <Text key={day} style={styles.calWeekDayText}>{day}</Text>
              ))}
            </View>

            <View style={styles.calDaysGrid}>
              {Array.from({ length: firstDayOfMonth }).map((_, idx) => (
                <View key={`empty-${idx}`} style={styles.calDayBoxEmpty} />
              ))}
              {Array.from({ length: daysInCurrentPickerMonth }).map((_, idx) => {
                const dayNum = idx + 1;
                const dateObj = new Date(pickerYear, pickerMonth, dayNum);
                const isFuture = dateObj.getTime() > today.setHours(23, 59, 59, 999);

                return (
                  <TouchableOpacity
                    key={dayNum}
                    style={[styles.calDayBox, isFuture && styles.calDayBoxFrozen]}
                    disabled={isFuture}
                    onPress={() => handleSelectDay(dayNum)}
                  >
                    <Text style={[styles.calDayText, isFuture && styles.calDayTextFrozen]}>
                      {dayNum}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setCalendarTarget(null)}>
              <Text style={styles.modalCloseText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Commodity Filter Modal */}
      <Modal visible={commodityFilterModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Filter Commodity</Text>
            <TouchableOpacity 
              style={styles.modalItem}
              onPress={() => { setFilterCommodity("All"); setCommodityFilterModalVisible(false); }}
            >
              <Text style={styles.modalItemText}>All Commodities</Text>
            </TouchableOpacity>
            {allAvailableCommodities.map(comm => (
              <TouchableOpacity 
                key={comm} 
                style={styles.modalItem}
                onPress={() => { setFilterCommodity(comm); setCommodityFilterModalVisible(false); }}
              >
                <Text style={styles.modalItemText}>{comm}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setCommodityFilterModalVisible(false)}>
              <Text style={styles.modalCloseText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Trader Modal */}
      <Modal visible={traderModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Trader</Text>
            {Object.keys(tenderDatabase).map(trader => (
              <TouchableOpacity key={trader} style={styles.modalItem} onPress={() => handleSelectTrader(trader)}>
                <Text style={styles.modalItemText}>{trader}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setTraderModalVisible(false)}>
              <Text style={styles.modalCloseText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Commodity Modal */}
      <Modal visible={commodityModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Commodity ({selectedTrader})</Text>
            {selectedTrader && Array.from(new Set(tenderDatabase[selectedTrader]?.map(item => item.commodity || "General"))).map(comm => (
              <TouchableOpacity key={comm} style={styles.modalItem} onPress={() => handleSelectCommodity(comm)}>
                <Text style={styles.modalItemText}>{comm}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setCommodityModalVisible(false)}>
              <Text style={styles.modalCloseText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Lot Modal */}
      <Modal visible={lotModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Lot ({selectedTrader} - {selectedCommodity})</Text>
            {selectedTrader && selectedCommodity && tenderDatabase[selectedTrader]
              ?.filter(lot => (lot.commodity || "General") === selectedCommodity)
              .map(lot => {
                const isSaved = savedBills.some(b => 
                  b.trader === selectedTrader && 
                  b.commodity === selectedCommodity && 
                  b.lotNo === lot.lotNo &&
                  b.date === currentDate
                );
                return (
                  <TouchableOpacity 
                    key={lot.lotNo} 
                    style={[styles.modalItem, isSaved && styles.modalItemFrozen]}
                    onPress={() => handleSelectLot(lot)}
                  >
                    <Text style={[styles.modalItemText, isSaved && styles.modalItemTextFrozen]}>
                      {lot.lotNo} ({lot.bags} Bags) - Rs {lot.price} {isSaved ? "🔒 (Saved)" : ""}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setLotModalVisible(false)}>
              <Text style={styles.modalCloseText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  loginContainer: { flex: 1, backgroundColor: '#f0f3f6', justifyContent: 'center', alignItems: 'center', padding: 20 },
  loginCard: { width: '100%', maxWidth: 380, backgroundColor: '#fff', borderRadius: 12, padding: 24, elevation: 3, alignItems: 'center' },
  loginTitle: { fontSize: 20, fontWeight: 'bold', color: '#2f3640', marginBottom: 6 },
  loginSubLabel: { fontSize: 13, color: '#718093', marginBottom: 20 },
  loginInput: { width: '100%', height: 46, borderWidth: 1, borderColor: '#dcdde1', borderRadius: 8, paddingHorizontal: 14, fontSize: 15, backgroundColor: '#f8f9fa', marginBottom: 12, color: '#2f3640' },
  errorText: { color: '#ff7675', fontSize: 12, marginBottom: 10, fontWeight: '600' },
  loginBtn: { width: '100%', backgroundColor: '#0984e3', paddingVertical: 12, borderRadius: 8, alignItems: 'center', marginTop: 6 },
  loginBtnText: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
  container: { flex: 1, backgroundColor: '#f0f3f6', paddingTop: Platform.OS === 'android' ? 25 : 0 },
  tabHeader: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderColor: '#dcdde1', elevation: 3, alignItems: 'center' },
  tabButton: { flex: 1, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  activeTabButton: { borderBottomWidth: 3, borderBottomColor: '#00b894', backgroundColor: '#f8f9fa' },
  tabText: { fontSize: 13, fontWeight: '600', color: '#718093' },
  activeTabText: { color: '#00b894', fontWeight: 'bold' },
  topImportBtn: { backgroundColor: '#0984e3', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 6, marginRight: 6 },
  topImportBtnText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  lockCornerBtn: { backgroundColor: '#ff7675', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 6, marginRight: 10 },
  lockCornerBtnText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  scrollContent: { padding: 16, paddingBottom: 40 },
  card: { backgroundColor: '#fff', borderRadius: 10, padding: 16, elevation: 2, marginBottom: 16 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  subLabel: { fontSize: 11, color: '#718093', fontWeight: '600', marginBottom: 4 },
  mainValue: { fontSize: 15, fontWeight: 'bold', color: '#2f3640' },
  divider: { height: 1, backgroundColor: '#f1f2f6', marginVertical: 14 },
  dropdownRow: { flexDirection: 'row', justifyContent: 'space-between' },
  dropdownSelector: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8f9fa', borderWidth: 1, borderColor: '#dcdde1', borderRadius: 6, paddingHorizontal: 8, height: 40 },
  dropdownText: { fontSize: 12, color: '#2f3640', fontWeight: '500', flex: 1 },
  dropdownArrow: { fontSize: 9, color: '#718093', marginLeft: 2 },
  priceBagBanner: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#e1f5fe', padding: 10, borderRadius: 6, marginTop: 12 },
  bannerText: { fontSize: 13, color: '#01579b', fontWeight: '600' },
  bannerHighlight: { fontWeight: 'bold' },
  gridContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  bagBox: { width: '22%', backgroundColor: '#f8f9fa', borderWidth: 1, borderColor: '#ced6e0', borderRadius: 6, padding: 6, alignItems: 'center' },
  bagBoxTitle: { fontSize: 11, fontWeight: 'bold', color: '#57606f', marginBottom: 4 },
  bagBoxInput: { width: '100%', height: 40, backgroundColor: '#fff', borderWidth: 1, borderColor: '#0984e3', borderRadius: 6, textAlign: 'center', fontSize: 14, fontWeight: 'bold', color: '#2d3436' },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  summaryLabel: { fontSize: 13, color: '#57606f', fontWeight: '600' },
  summaryValue: { fontSize: 14, fontWeight: 'bold', color: '#2f3640' },
  lessInput: { width: 90, height: 40, borderWidth: 1, borderColor: '#0984e3', borderRadius: 6, textAlign: 'center', fontSize: 14, fontWeight: 'bold', color: '#2d3436', backgroundColor: '#fff' },
  summaryLabelNet: { fontSize: 14, color: '#2f3640', fontWeight: 'bold' },
  summaryValueNet: { fontSize: 16, fontWeight: 'bold', color: '#e17055' },
  summaryLabelAmount: { fontSize: 15, color: '#00b894', fontWeight: 'bold' },
  summaryValueAmount: { fontSize: 18, fontWeight: 'bold', color: '#00b894' },
  actionButtonsRow: { flexDirection: 'row', gap: 10, marginBottom: 30 },
  resetBtn: { flex: 1, backgroundColor: '#ff7675', paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  resetBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  printBtn: { flex: 1, backgroundColor: '#0984e3', paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  printBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  saveBtn: { flex: 1, backgroundColor: '#00b894', paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  sectionHeader: { fontSize: 14, fontWeight: 'bold', color: '#2f3640', marginBottom: 12 },
  dateFilterContainer: { marginBottom: 14, backgroundColor: '#fff', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#dcdde1' },
  filterRowTop: { flexDirection: 'row', justifyContent: 'space-between' },
  filterRowBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  calendarBox: { height: 40, borderWidth: 1, borderColor: '#dcdde1', borderRadius: 6, paddingHorizontal: 10, backgroundColor: '#f8f9fa', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  calendarBoxText: { fontSize: 12, color: '#2f3640', fontWeight: '600', flex: 1 },
  placeholderText: { color: '#a4b0be', fontWeight: 'normal' },
  calendarIcon: { fontSize: 14 },
  clearDateBtn: { height: 40, backgroundColor: '#dfe6e9', paddingHorizontal: 10, borderRadius: 6, justifyContent: 'center', alignItems: 'center', marginRight: 6 },
  clearDateBtnText: { color: '#2d3436', fontWeight: 'bold', fontSize: 11 },
  exportExcelBtn: { height: 40, backgroundColor: '#00b894', paddingHorizontal: 14, borderRadius: 6, justifyContent: 'center', alignItems: 'center' },
  exportExcelBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
  noBillsText: { fontSize: 13, color: '#718093', fontStyle: 'italic', textAlign: 'center', marginTop: 20 },
  savedBillCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', padding: 14, borderRadius: 8, marginBottom: 10, borderWidth: 1, borderColor: '#dcdde1' },
  savedBillTitle: { fontSize: 14, fontWeight: 'bold', color: '#2f3640' },
  savedBillSub: { fontSize: 12, color: '#57606f', marginVertical: 2 },
  savedBillDate: { fontSize: 11, color: '#b2bec3' },
  reprintBtn: { backgroundColor: '#0984e3', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 6 },
  reprintBtnText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '85%', maxWidth: 400, backgroundColor: '#fff', borderRadius: 10, padding: 20 },
  modalTitle: { fontSize: 16, fontWeight: 'bold', color: '#2f3640', marginBottom: 15, textAlign: 'center' },
  modalItem: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f1f2f6' },
  modalItemFrozen: { backgroundColor: '#f1f2f6', opacity: 0.6 },
  modalItemText: { fontSize: 14, color: '#2f3640', fontWeight: '500' },
  modalItemTextFrozen: { color: '#b2bec3', textDecorationLine: 'line-through' },
  modalCloseBtn: { marginTop: 15, backgroundColor: '#b2bec3', paddingVertical: 10, borderRadius: 6, alignItems: 'center' },
  modalCloseText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  calendarModalContent: { width: '90%', maxWidth: 340, backgroundColor: '#fff', borderRadius: 12, padding: 18, elevation: 5 },
  calNavHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  calNavTitle: { fontSize: 16, fontWeight: 'bold', color: '#2f3640' },
  calNavBtn: { padding: 8, backgroundColor: '#f1f2f6', borderRadius: 6 },
  disabledCalNav: { opacity: 0.3 },
  calNavBtnText: { fontSize: 14, color: '#2f3640', fontWeight: 'bold' },
  calWeekRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8, borderBottomWidth: 1, borderBottomColor: '#f1f2f6', paddingBottom: 6 },
  calWeekDayText: { width: '14.28%', textAlign: 'center', fontSize: 12, color: '#718093', fontWeight: 'bold' },
  calDaysGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calDayBoxEmpty: { width: '14.28%', height: 38 },
  calDayBox: { width: '14.28%', height: 38, justifyContent: 'center', alignItems: 'center', borderRadius: 4 },
  calDayBoxFrozen: { opacity: 0.25, backgroundColor: '#f5f6fa' },
  calDayText: { fontSize: 13, color: '#2f3640', fontWeight: '600' },
  calDayTextFrozen: { color: '#a4b0be', textDecorationLine: 'line-through' },
});
import * as DocumentPicker from 'expo-document-picker';
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

const RENDER_BACKEND_URL = 'http://localhost:3000';

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun", 
  "Jul", "Aug", "Sept", "Oct", "Nov", "Dec"
];

function generateUniqueId(dateStr: string, existingBills: any[]): string {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yy = String(now.getFullYear()).slice(-2);
  const baseId = `M${dd}${mm}${yy}D`;

  const todayBillsCount = existingBills.filter(b => b.uniqueId && b.uniqueId.startsWith(baseId)).length;
  const sequenceNum = todayBillsCount + 1;

  return `${baseId}-${sequenceNum}`;
}

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
  const [userRole, setUserRole] = useState<'ca' | 'admin'>('ca');
  
  const [usernameInput, setUsernameInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [loginError, setLoginError] = useState("");
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'reset'>('login');
  
  const [newCaName, setNewCaName] = useState("");
  const [newCaPassword, setNewCaPassword] = useState("");
  const [resetCaName, setResetCaName] = useState("");
  const [resetCaNewPassword, setResetCaNewPassword] = useState("");

  const [registeredCAs, setRegisteredCAs] = useState<Record<string, string>>({
    "nitin ca": "123",
    "admin ca 1": "123",
    "admin ca 2": "123"
  });

  const adminUsername = "admin";
  const adminPassword = "1234";

  useEffect(() => {
    const fetchRegisteredCAs = async () => {
      try {
        const res = await fetch(`${RENDER_BACKEND_URL}/api/cas`);
        const data = await res.json();
        if (data && typeof data === 'object' && Object.keys(data).length > 0) {
          let normalizedObj: Record<string, string> = {};
          Object.keys(data).forEach(k => {
            normalizedObj[k.trim().toLowerCase()] = data[k];
          });
          setRegisteredCAs(normalizedObj);
        }
      } catch (e) {
        console.log("Using local default CAs fallback");
      }
    };
    fetchRegisteredCAs();
  }, []);

  const handleRegisterCA = async () => {
    if (!newCaName.trim() || !newCaPassword.trim()) {
      alert("Please enter both CA Name and CA Password.");
      return;
    }
    const cleanNewName = newCaName.trim().toLowerCase();
    if (registeredCAs[cleanNewName]) {
      alert("This CA Name is already registered. Please use a different name or login.");
      return;
    }

    try {
      const response = await fetch(`${RENDER_BACKEND_URL}/api/cas/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caName: cleanNewName, password: newCaPassword.trim() })
      });
      const result = await response.json();

      if (response.ok || result.success) {
        setRegisteredCAs(prev => ({ ...prev, [cleanNewName]: newCaPassword.trim() }));
        alert(`CA Registration Saved to ca_registered Table Successfully! Welcome, ${newCaName.trim()}`);
        setAuthMode('login');
        setNewCaName("");
        setNewCaPassword("");
      } else {
        alert(result.error || "Failed to register CA in database.");
      }
    } catch (err) {
      setRegisteredCAs(prev => ({ ...prev, [cleanNewName]: newCaPassword.trim() }));
      alert(`CA Registration Successful Locally! Welcome, ${newCaName.trim()}`);
      setAuthMode('login');
      setNewCaName("");
      setNewCaPassword("");
    }
  };

  const handleResetPassword = () => {
    if (!resetCaName.trim() || !resetCaNewPassword.trim()) {
      alert("Please enter both CA Name and New Password.");
      return;
    }
    const cleanResetName = resetCaName.trim().toLowerCase();
    if (!registeredCAs[cleanResetName]) {
      alert("CA Name not found in registered database. Please register first.");
      return;
    }

    setRegisteredCAs(prev => ({ ...prev, [cleanResetName]: resetCaNewPassword.trim() }));
    alert(`Password reset successfully for ${resetCaName.trim()}! You can now login.`);
    setAuthMode('login');
    setResetCaName("");
    setResetCaNewPassword("");
  };

  const handleLogin = (role: 'ca' | 'admin') => {
    setUserRole(role);
    if (role === 'ca') {
      const trimmedUser = usernameInput.trim().toLowerCase();
      const expectedPassword = registeredCAs[trimmedUser];

      if (expectedPassword && expectedPassword === passwordInput) {
        setIsLoggedIn(true);
        setLoginError("");
        setUsernameInput("");
        setPasswordInput("");
        setCaName(usernameInput.trim());
        setActiveTab('entry');
      } else if (trimmedUser === "nitin ca" && passwordInput === "123") {
        setIsLoggedIn(true);
        setLoginError("");
        setUsernameInput("");
        setPasswordInput("");
        setCaName("Nitin CA");
        setActiveTab('entry');
      } else {
        setLoginError("❌ Incorrect CA Username or Password.");
      }
    } else if (role === 'admin') {
      if (usernameInput.trim().toLowerCase() === adminUsername && passwordInput === adminPassword) {
        setIsLoggedIn(true);
        setLoginError("");
        setUsernameInput("");
        setPasswordInput("");
        setActiveTab('admin');
      } else {
        setLoginError("❌ Incorrect Admin Username or Password.");
      }
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setUsernameInput("");
    setPasswordInput("");
  };

  const [activeTab, setActiveTab] = useState('entry');
  const [caName, setCaName] = useState("Nitin CA");
  const [adminCaSelectModalVisible, setAdminCaSelectModalVisible] = useState(false);
  const availableCAs = Object.keys(registeredCAs);
  
  const optionsCurrent: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };
  const formattedToday = new Date().toLocaleDateString('en-GB', optionsCurrent);
  const [currentDate, setItemsDate] = useState(formattedToday);

  const [fromDateStr, setFromDateStr] = useState("");
  const [toDateStr, setToDateStr] = useState("");
  const [filterCommodity, setFilterCommodity] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

  const [calendarTarget, setCalendarTarget] = useState<'from' | 'to' | null>(null);
  const today = new Date();
  const [pickerYear, setPickerYear] = useState(today.getFullYear());
  const [pickerMonth, setPickerMonth] = useState(today.getMonth());
  const [commodityFilterModalVisible, setCommodityFilterModalVisible] = useState(false);

  const [tenderDatabase, setTenderDatabase] = useState<Record<string, any[]>>({});
  const [rawTendersList, setRawTendersList] = useState<any[]>([]);

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
    const fetchCloudData = async () => {
      try {
        const tendersRes = await fetch(`${RENDER_BACKEND_URL}/api/tenders`);
        const tendersData = await tendersRes.json();
        
        if (Array.isArray(tendersData)) {
          setRawTendersList(tendersData);
          let grouped: Record<string, any[]> = {};
          tendersData.forEach(item => {
            const itemCa = (item.ca_name || "").trim().toLowerCase();
            const currentActiveCa = caName.trim().toLowerCase();

            if (userRole === 'admin' || itemCa === currentActiveCa) {
              const tr = item.trader || "Unknown Trader";
              if (!grouped[tr]) grouped[tr] = [];
              grouped[tr].push({
                lotNo: item.lot_no || item.lotNo,
                commodity: item.commodity || "General",
                price: parseFloat(item.price) || 0,
                bags: parseInt(item.bags, 10) || 1,
                date: item.upload_date || item.date || formattedToday,
                batchId: item.batch_id,
                fileName: item.file_name,
                caName: item.ca_name || caName
              });
            }
          });
          setTenderDatabase(grouped);
        }

        const billsRes = await fetch(`${RENDER_BACKEND_URL}/api/bills`);
        const billsData = await billsRes.json();
        if (Array.isArray(billsData)) {
          const normalizedBills = billsData.map((b: any) => ({
            id: b.id,
            uniqueId: b.uniqueId || b.unique_id,
            date: b.date || b.trade_date || b.weighed_date || formattedToday,
            caName: b.caName || b.ca_name || "Nitin CA",
            trader: b.trader,
            commodity: b.commodity,
            lotNo: b.lotNo || b.lot_no,
            bags: b.bags,
            bagWeights: typeof b.bagWeights === 'string' ? JSON.parse(b.bagWeights) : (b.bagWeights || b.bag_weights || {}),
            totalQty: b.totalQty || b.total_qty || "0",
            lessQty: b.lessQty || b.less_qty || "0",
            netQty: b.netQty || b.net_qty || "0",
            price: b.price || 0,
            amount: b.amount || "0"
          }));
          setSavedBills(normalizedBills);
        }
      } catch (e) {
        console.error("Failed to fetch cloud data from backend", e);
      }
    };
    fetchCloudData();
  }, [caName, userRole]);

  const handleExcelImport = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel', 'text/csv', '*/*'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const fileUri = result.assets[0].uri;
        const fileName = result.assets[0].name || "TenderFile.xlsx";

        const formData = new FormData();
        formData.append('caName', caName);
        
        if (Platform.OS === 'web') {
          const response = await fetch(fileUri);
          const blob = await response.blob();
          formData.append('file', blob, fileName);
        } else {
          formData.append('file', {
            uri: fileUri,
            name: fileName,
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          } as any);
        }

        const uploadRes = await fetch(`${RENDER_BACKEND_URL}/api/tenders/upload`, {
          method: 'POST',
          body: formData,
        });

        const responseText = await uploadRes.text();
        let uploadResult;
        try {
          uploadResult = JSON.parse(responseText);
        } catch (e) {
          console.error("Server HTML Error Response:", responseText);
          alert(responseText || "Server error. Check backend terminal logs.");
          return;
        }

        if (uploadRes.ok && uploadResult.success) {
          const tendersRes = await fetch(`${RENDER_BACKEND_URL}/api/tenders`);
          const tendersData = await tendersRes.json();
          if (Array.isArray(tendersData)) {
            setRawTendersList(tendersData);
            let grouped: Record<string, any[]> = {};
            tendersData.forEach(item => {
              const itemCa = (item.ca_name || "").trim().toLowerCase();
              const currentActiveCa = caName.trim().toLowerCase();
              if (userRole === 'admin' || itemCa === currentActiveCa) {
                const tr = item.trader || "Unknown Trader";
                if (!grouped[tr]) grouped[tr] = [];
                grouped[tr].push({
                  lotNo: item.lot_no || item.lotNo,
                  commodity: item.commodity || "General",
                  price: parseFloat(item.price) || 0,
                  bags: parseInt(item.bags, 10) || 1,
                  date: item.upload_date || item.date || formattedToday,
                  batchId: item.batch_id,
                  fileName: item.file_name,
                  caName: item.ca_name || caName
                });
              }
            });
            setTenderDatabase(grouped);
          }

          setItemsDate(formattedToday);
          setSelectedTrader("");
          setSelectedCommodity("");
          setSelectedLot(null);
          setBagWeights({});
          setLessQty("0");
          alert(`Previous tenders cleared. Current file uploaded successfully for CA: ${caName}!`);
        } else {
          alert(uploadResult.error || "Failed to upload tender batch.");
        }
      }
    } catch (error) {
      console.error("Import error:", error);
      alert("Error reading or saving file to database.");
    }
  };

  const handleSelectTrader = (trader: string) => {
    setSelectedTrader(trader);
    setSelectedCommodity("");
    setSelectedLot(null);
    setBagWeights({});
    setTraderModalVisible(false);
  };

  const handleSelectCommodity = (comm: string) => {
    setSelectedCommodity(comm);
    setSelectedLot(null);
    setBagWeights({});
    setCommodityModalVisible(false);
  };

  const handleSelectLot = (lot: any) => {
    setSelectedLot(lot);
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
    const performReset = async () => {
      try {
        await fetch(`${RENDER_BACKEND_URL}/api/tenders`, { method: 'DELETE' });
        setTenderDatabase({});
        setRawTendersList([]);
        setSelectedTrader("");
        setSelectedCommodity("");
        setSelectedLot(null);
        setLessQty("0");
        setBagWeights({});
        if (Platform.OS === 'web') alert("Reset successful! Tender database cleared and selectors unlocked.");
      } catch (e) {
        console.error("Error resetting tenders", e);
        alert("Failed to clear tender database.");
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm("Are you sure you want to reset? This will clear uploaded tender lots and unlock selectors. Saved bills will NOT be deleted.")) performReset();
    } else {
      Alert.alert("Confirm Reset", "Are you sure you want to reset? This will clear uploaded tender lots and unlock selectors. Saved bills will NOT be deleted.", [
        { text: "Cancel", style: "cancel" },
        { text: "Reset", style: "destructive", onPress: performReset }
      ]);
    }
  };

  const handleSaveBill = async () => {
    if (!selectedTrader || !selectedCommodity || !selectedLot) {
      alert("Please select a Trader, Commodity, and Lot before saving.");
      return;
    }

    let currentBagWeightsObj: Record<string, string> = {};
    for (let i = 1; i <= totalBagsCount; i++) {
      currentBagWeightsObj[`B${i}`] = bagWeights[i] || "0";
    }

    const uniqueId = generateUniqueId(currentDate, savedBills);

    const newBill = {
      id: Date.now().toString(),
      uniqueId,
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

    try {
      const response = await fetch(`${RENDER_BACKEND_URL}/api/bills`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newBill)
      });
      const result = await response.json();

      if (response.ok) {
        setSavedBills(prev => [newBill, ...prev]);
        setTenderDatabase(prev => {
          const updatedTraderLots = (prev[selectedTrader] || []).filter(l => l.lotNo !== selectedLot.lotNo);
          return { ...prev, [selectedTrader]: updatedTraderLots };
        });
        setSelectedLot(null);
        setLessQty("0");
        setBagWeights({});
        alert(`Saved Successfully! ID: ${uniqueId}`);
      } else {
        alert(result.error || "Failed to save bill to database.");
      }
    } catch (error) {
      console.error("Error saving bill to cloud:", error);
      alert("Network error while saving bill.");
    }
  };

  const handleDeleteBill = async (billId: string) => {
    const performDelete = async () => {
      try {
        setSavedBills(prev => prev.filter(b => b.id !== billId));
        await fetch(`${RENDER_BACKEND_URL}/api/bills/${billId}`, {
          method: 'DELETE'
        }).catch(() => {});
        alert("Saved bill deleted successfully.");
      } catch (e) {
        console.error("Error deleting bill", e);
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm("Are you sure you want to delete this saved bill?")) {
        performDelete();
      }
    } else {
      Alert.alert("Delete Saved Bill", "Are you sure you want to delete this saved bill?", [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: performDelete }
      ]);
    }
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
          <title>Aada Bill - ${selectedTrader}</title>
          <style>
            body { font-family: 'Helvetica Neue', Arial, sans-serif; padding: 20px; color: #2d3436; max-width: 450px; margin: auto; }
            .receipt-box { border: 2px dashed #0984e3; padding: 20px; border-radius: 8px; background: #fdfdfd; }
            .header { text-align: center; border-bottom: 2px solid #2d3436; padding-bottom: 8px; margin-bottom: 12px; }
            .header h2 { margin: 0; font-size: 18px; color: #0984e3; letter-spacing: 1px; }
            .header p { margin: 4px 0 0; font-size: 11px; color: #636e72; }
            .row { display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 13px; }
            .bags-grid { display: flex; flex-wrap: wrap; gap: 4px; margin: 8px 0; }
            .bag-item { border: 1px solid #74b9ff; background: #e8f4fd; padding: 3px 6px; border-radius: 3px; font-size: 11px; }
            .total-section { font-size: 15px; color: #00b894; font-weight: bold; margin-top: 12px; border-top: 2px solid #2d3436; padding-top: 8px; }
            .footer { text-align: center; margin-top: 20px; font-size: 10px; color: #b2bec3; }
          </style>
        </head>
        <body>
          <div class="receipt-box">
            <div class="header">
              <h2>TUKA ENTRY PLATFORM AADA BILL</h2>
              <p>Date: ${currentDate} | Authorized CA: ${caName}</p>
            </div>
            <div class="row"><strong>Trader:</strong> <span>${selectedTrader}</span></div>
            <div class="row"><strong>Commodity:</strong> <span>${selectedCommodity}</span></div>
            <div class="row"><strong>Lot Number:</strong> <span>${selectedLot.lotNo}</span></div>
            <div class="row"><strong>Price per Quintal:</strong> <span>Rs ${selectedLot.price}</span></div>
            <div class="row"><strong>Total Bags:</strong> <span>${totalBagsCount}</span></div>
            <div class="bags-grid">${bagsHtml}</div>
            <div class="row"><strong>Gross Qty:</strong> <span>${totalQty.toFixed(2)} kg</span></div>
            <div class="row"><strong>Less Qty (Bardana):</strong> <span>${lessQtyNum} kg</span></div>
            <div class="row"><strong>Net Qty:</strong> <span>${netQty.toFixed(2)} kg</span></div>
            <div class="row total-section"><span>Total Amount:</span> <span>Rs ${totalAmount.toFixed(2)}</span></div>
            <div class="footer">Verified & Generated Digitally</div>
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
          <title>Aada Bill - ${bill.trader}</title>
          <style>
            body { font-family: 'Helvetica Neue', Arial, sans-serif; padding: 20px; color: #2d3436; max-width: 450px; margin: auto; }
            .receipt-box { border: 2px dashed #00b894; padding: 20px; border-radius: 8px; background: #fdfdfd; }
            .header { text-align: center; border-bottom: 2px solid #2d3436; padding-bottom: 8px; margin-bottom: 12px; }
            .header h2 { margin: 0; font-size: 18px; color: #00b894; letter-spacing: 1px; }
            .header p { margin: 4px 0 0; font-size: 11px; color: #636e72; }
            .row { display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 13px; }
            .bags-grid { display: flex; flex-wrap: wrap; gap: 4px; margin: 8px 0; }
            .bag-item { border: 1px solid #55efc4; background: #e8f8f5; padding: 3px 6px; border-radius: 3px; font-size: 11px; }
            .total-section { font-size: 15px; color: #00b894; font-weight: bold; margin-top: 12px; border-top: 2px solid #2d3436; padding-top: 8px; }
            .footer { text-align: center; margin-top: 20px; font-size: 10px; color: #b2bec3; }
          </style>
        </head>
        <body>
          <div class="receipt-box">
            <div class="header">
              <h2>TUKA ENTRY PLATFORM BILL (REPRINT)</h2>
              <p>ID: ${bill.uniqueId} | Date: ${bill.date} | CA: ${bill.caName}</p>
            </div>
            <div class="row"><strong>Trader:</strong> <span>${bill.trader}</span></div>
            <div class="row"><strong>Commodity:</strong> <span>${bill.commodity || 'N/A'}</span></div>
            <div class="row"><strong>Lot Number:</strong> <span>${bill.lotNo}</span></div>
            <div class="row"><strong>Price per Quintal:</strong> <span>Rs ${bill.price}</span></div>
            <div class="row"><strong>Total Bags:</strong> <span>${bill.bags}</span></div>
            <div class="bags-grid">${savedBagsHtml}</div>
            <div class="row"><strong>Gross Qty:</strong> <span>${bill.totalQty} kg</span></div>
            <div class="row"><strong>Less Qty:</strong> <span>${bill.lessQty} kg</span></div>
            <div class="row"><strong>Net Qty:</strong> <span>${bill.netQty} kg</span></div>
            <div class="row total-section"><span>Total Amount:</span> <span>Rs ${bill.amount}</span></div>
            <div class="footer">Duplicate Reprint Copy</div>
          </div>
          <script>window.onload = function() { window.print(); }</script>
        </body>
      </html>
    `;
    triggerPrint(htmlContent);
  };

  const roleScopedBills = userRole === 'admin' 
    ? savedBills 
    : savedBills.filter(bill => (bill.caName || '').trim().toLowerCase() === caName.trim().toLowerCase());

  const filteredSavedBills = roleScopedBills.filter(bill => {
    if (filterCommodity !== "All" && (bill.commodity || "General") !== filterCommodity) {
      return false;
    }
    if (searchQuery.trim() !== "") {
      const q = searchQuery.toLowerCase();
      const matchTrader = (bill.trader || "").toLowerCase().includes(q);
      const matchLot = String(bill.lotNo || "").toLowerCase().includes(q);
      const matchId = (bill.uniqueId || "").toLowerCase().includes(q);
      if (!matchTrader && !matchLot && !matchId) return false;
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

  const handleExportExcel = () => {
    if (filteredSavedBills.length === 0) {
      alert("No bills available to export for the selected filter.");
      return;
    }

    const exportData = filteredSavedBills.map((b, index) => {
      let rowObj: Record<string, any> = {
        "Sl No": index + 1,
        "Unique ID": b.uniqueId || "",
        "Date": b.date || "",
        "CA Name": b.caName || "",
        "Trader Name": b.trader || "",
        "Commodity": b.commodity || "",
        "Lot Number": b.lotNo || "",
        "Total Bags": b.bags || 0
      };

      if (b.bagWeights) {
        const bagKeys = Object.keys(b.bagWeights).sort((x, y) => {
          const numX = parseInt(x.replace(/\D/g, ''), 10) || 0;
          const numY = parseInt(y.replace(/\D/g, ''), 10) || 0;
          return numX - numY;
        });
        bagKeys.forEach(bagKey => {
          rowObj[bagKey] = b.bagWeights[bagKey];
        });
      }

      rowObj["Total Qty"] = b.totalQty || 0;
      rowObj["Less Qty"] = b.lessQty || 0;
      rowObj["Net Qty"] = b.netQty || 0;
      rowObj["Price"] = b.price || 0;
      rowObj["Total Amount"] = b.amount || 0;

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
          <Text style={styles.loginTitle}>🔒 TUKA ENTRY PLATFORM</Text>
          <Text style={styles.loginSubLabel}>Enter Username & Password</Text>
          
          {authMode === 'login' && (
            <>
              <TextInput
                style={styles.loginInput}
                placeholder="Username (e.g. Nitin CA or admin)"
                placeholderTextColor="#b2bec3"
                value={usernameInput}
                onChangeText={setUsernameInput}
                autoCapitalize="none"
                autoComplete="username"
              />
              <TextInput
                style={styles.loginInput}
                secureTextEntry
                placeholder="Password"
                placeholderTextColor="#b2bec3"
                value={passwordInput}
                onChangeText={setPasswordInput}
                returnKeyType="done"
                autoComplete="new-password"
              />
              {loginError ? <Text style={styles.errorText}>{loginError}</Text> : null}

              <View style={{ flexDirection: 'row', gap: 10, width: '100%', marginTop: 6 }}>
                <TouchableOpacity style={[styles.loginBtn, { flex: 1, backgroundColor: '#0984e3' }]} onPress={() => handleLogin('ca')}>
                  <Text style={styles.loginBtnText}>CA Login</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.loginBtn, { flex: 1, backgroundColor: '#00b894' }]} onPress={() => handleLogin('admin')}>
                  <Text style={styles.loginBtnText}>Admin Login</Text>
                </TouchableOpacity>
              </View>

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginTop: 14 }}>
                <TouchableOpacity onPress={() => setAuthMode('register')}>
                  <Text style={styles.switchModeText}>New CA? Register</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setAuthMode('reset')}>
                  <Text style={[styles.switchModeText, { color: '#e17055' }]}>Reset Password</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {authMode === 'register' && (
            <View style={{ width: '100%', marginTop: 4 }}>
              <Text style={styles.subLabel}>CA Username</Text>
              <TextInput
                style={styles.loginInput}
                placeholder="Enter CA Username"
                placeholderTextColor="#b2bec3"
                value={newCaName}
                onChangeText={setNewCaName}
                autoCapitalize="none"
                autoComplete="username"
              />
              <Text style={styles.subLabel}>CA Password</Text>
              <TextInput
                style={styles.loginInput}
                secureTextEntry
                placeholder="Enter Password"
                placeholderTextColor="#b2bec3"
                value={newCaPassword}
                onChangeText={setNewCaPassword}
                autoComplete="new-password"
              />
              <TouchableOpacity style={[styles.loginBtn, { backgroundColor: '#e17055', marginTop: 6, width: '100%' }]} onPress={handleRegisterCA}>
                <Text style={styles.loginBtnText}>Register CA</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.switchModeBtn} onPress={() => { setAuthMode('login'); setNewCaName(''); setNewCaPassword(''); }}>
                <Text style={styles.switchModeText}>Back to Login</Text>
              </TouchableOpacity>
            </View>
          )}

          {authMode === 'reset' && (
            <View style={{ width: '100%', marginTop: 4 }}>
              <Text style={styles.subLabel}>CA Username</Text>
              <TextInput
                style={styles.loginInput}
                placeholder="Enter Registered CA Username"
                placeholderTextColor="#b2bec3"
                value={resetCaName}
                onChangeText={setResetCaName}
                autoCapitalize="none"
                autoComplete="username"
              />
              <Text style={styles.subLabel}>New CA Password</Text>
              <TextInput
                style={styles.loginInput}
                secureTextEntry
                placeholder="Enter New Password"
                placeholderTextColor="#b2bec3"
                value={resetCaNewPassword}
                onChangeText={setResetCaNewPassword}
                autoComplete="new-password"
              />
              <TouchableOpacity style={[styles.loginBtn, { backgroundColor: '#6c5ce7', marginTop: 6, width: '100%' }]} onPress={handleResetPassword}>
                <Text style={styles.loginBtnText}>Update Password</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.switchModeBtn} onPress={() => { setAuthMode('login'); setResetCaName(''); setResetCaNewPassword(''); }}>
                <Text style={styles.switchModeText}>Back to Login</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </SafeAreaView>
    );
  }

  const daysInCurrentPickerMonth = new Date(pickerYear, pickerMonth + 1, 0).getDate();
  const firstDayOfMonth = new Date(pickerYear, pickerMonth, 1).getDay();
  const allAvailableCommodities = Array.from(new Set(roleScopedBills.map(b => b.commodity || "General")));

  const todayTotalBillsCount = roleScopedBills.filter(b => b.date === currentDate).length;
  const todayTotalNetWeight = roleScopedBills
    .filter(b => b.date === currentDate)
    .reduce((acc, curr) => acc + (parseFloat(curr.netQty) || 0), 0);

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
            Saved Bills / Reprint ({roleScopedBills.length})
          </Text>
        </TouchableOpacity>

        {userRole === 'admin' && (
          <TouchableOpacity 
            style={[styles.tabButton, activeTab === 'admin' && styles.activeTabButton]}
            onPress={() => setActiveTab('admin')}
          >
            <Text style={[styles.tabText, activeTab === 'admin' && styles.activeTabText]}>⚙️ Admin Lot Upload</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.lockCornerBtn} onPress={handleLogout}>
          <Text style={styles.lockCornerBtnText}>🔒 Lock</Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'entry' ? (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.dashboardMetricRow}>
            <View style={styles.metricCard}>
              <Text style={styles.metricTitle}>Today's Bills</Text>
              <Text style={styles.metricValue}>{todayTotalBillsCount}</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricTitle}>Today's Weighed</Text>
              <Text style={styles.metricValue}>{todayTotalNetWeight.toFixed(2)} kg</Text>
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.rowBetween}>
              <View>
                <Text style={styles.subLabel}>Date</Text>
                <Text style={styles.mainValue}>{currentDate}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.subLabel}>CA Name</Text>
                {userRole === 'admin' ? (
                  <TouchableOpacity onPress={() => setAdminCaSelectModalVisible(true)}>
                    <Text style={[styles.mainValue, { color: '#0984e3', textDecorationLine: 'underline' }]}>{caName} ▼</Text>
                  </TouchableOpacity>
                ) : (
                  <Text style={styles.mainValue}>{caName}</Text>
                )}
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.dropdownRow}>
              <View style={{ flex: 1.5, marginRight: 8 }}>
                <Text style={styles.subLabel}>Select Trader</Text>
                <TouchableOpacity 
                  style={styles.dropdownSelector} 
                  onPress={() => setTraderModalVisible(true)}
                >
                  <Text style={styles.dropdownText} numberOfLines={1}>{selectedTrader || "Trader"}</Text>
                  <Text style={styles.dropdownArrow}>▼</Text>
                </TouchableOpacity>
              </View>

              <View style={{ flex: 1.5, marginHorizontal: 4 }}>
                <Text style={styles.subLabel}>Commodity</Text>
                <TouchableOpacity 
                  style={styles.dropdownSelector} 
                  disabled={!selectedTrader}
                  onPress={() => { if (selectedTrader) setCommodityModalVisible(true); }}
                >
                  <Text style={styles.dropdownText} numberOfLines={1}>{selectedCommodity || "Commodity"}</Text>
                  <Text style={styles.dropdownArrow}>▼</Text>
                </TouchableOpacity>
              </View>

              <View style={{ flex: 1.5, marginLeft: 8 }}>
                <Text style={styles.subLabel}>Select Lot</Text>
                <TouchableOpacity 
                  style={styles.dropdownSelector} 
                  disabled={!selectedTrader || !selectedCommodity}
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
                {selectedLot.fileName && <Text style={styles.bannerText}>File: <Text style={styles.bannerHighlight}>{selectedLot.fileName}</Text></Text>}
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
            <TouchableOpacity style={styles.printBtn} onPress={handlePrintCurrent}>
              <Text style={styles.printBtnText}>🖨 Print Bill</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.saveBtn} onPress={handleSaveBill}>
              <Text style={styles.saveBtnText}>Save Bill</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      ) : activeTab === 'admin' && userRole === 'admin' ? (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Text style={styles.sectionHeader}>⚙️ Admin Panel - Lot Upload & Management</Text>
          
          <View style={styles.card}>
            <Text style={styles.subLabel}>Select CA Name for Upload</Text>
            <TouchableOpacity 
              style={[styles.dropdownSelector, { marginBottom: 16 }]} 
              onPress={() => setAdminCaSelectModalVisible(true)}
            >
              <Text style={styles.dropdownText}>{caName}</Text>
              <Text style={styles.dropdownArrow}>▼</Text>
            </TouchableOpacity>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity style={[styles.adminUploadBtn, { flex: 2 }]} onPress={handleExcelImport}>
                <Text style={styles.adminUploadBtnText}>📁 Upload Tender Excel File</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.resetBtn, { flex: 1, paddingVertical: 14 }]} onPress={handleReset}>
                <Text style={styles.resetBtnText}>Reset Lots</Text>
              </TouchableOpacity>
            </View>
          </View>

          <Text style={styles.sectionHeader}>Current Active Uploaded Lots:</Text>
          {rawTendersList.length === 0 ? (
            <Text style={styles.noBillsText}>No active tender lots currently uploaded.</Text>
          ) : (
            <View style={styles.tableContainer}>
              <View style={[styles.tableRow, styles.tableHeaderRow]}>
                <Text style={[styles.tableCellHeader, { flex: 1 }]}>Upload Date</Text>
                <Text style={[styles.tableCellHeader, { flex: 1 }]}>CA Name</Text>
                <Text style={[styles.tableCellHeader, { flex: 1.2 }]}>Trader Name</Text>
                <Text style={[styles.tableCellHeader, { flex: 0.8 }]}>Lot No</Text>
                <Text style={[styles.tableCellHeader, { flex: 0.8 }]}>Price</Text>
                <Text style={[styles.tableCellHeader, { flex: 0.6 }]}>Bags</Text>
              </View>

              {rawTendersList.map((item, index) => (
                <View key={index} style={[styles.tableRow, index % 2 === 1 && styles.tableRowAlternate]}>
                  <Text style={[styles.tableCell, { flex: 1 }]}>{item.upload_date || currentDate}</Text>
                  <Text style={[styles.tableCellBold, { flex: 1 }]} numberOfLines={1}>{item.ca_name || caName}</Text>
                  <Text style={[styles.tableCell, { flex: 1.2 }]} numberOfLines={1}>{item.trader}</Text>
                  <Text style={[styles.tableCellBold, { flex: 0.8 }]}>{item.lot_no || item.lotNo}</Text>
                  <Text style={[styles.tableCell, { flex: 0.8 }]}>Rs {item.price}</Text>
                  <Text style={[styles.tableCell, { flex: 0.6 }]}>{item.bags}</Text>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Text style={styles.sectionHeader}>Saved Aada Bill-gala Patti (Re-print & Delete):</Text>
          
          <View style={styles.dateFilterContainer}>
            <View style={{ marginBottom: 10 }}>
              <Text style={styles.subLabel}>Search Trader, Lot No, or ID</Text>
              <TextInput
                style={styles.searchBarInput}
                placeholder="Type to search..."
                placeholderTextColor="#a4b0be"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>

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
                {(fromDateStr || toDateStr || filterCommodity !== "All" || searchQuery !== "") && (
                  <TouchableOpacity 
                    style={styles.clearDateBtn} 
                    onPress={() => { setFromDateStr(""); setToDateStr(""); setFilterCommodity("All"); setSearchQuery(""); }}
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
            <View style={styles.tableContainer}>
              <View style={[styles.tableRow, styles.tableHeaderRow]}>
                <Text style={[styles.tableCellHeader, { flex: 1.1 }]}>ID / Date</Text>
                <Text style={[styles.tableCellHeader, { flex: 0.9 }]}>CA Name</Text>
                <Text style={[styles.tableCellHeader, { flex: 1.1 }]}>Trader</Text>
                <Text style={[styles.tableCellHeader, { flex: 0.9 }]}>Commodity</Text>
                <Text style={[styles.tableCellHeader, { flex: 0.7 }]}>Less Qty</Text>
                <Text style={[styles.tableCellHeader, { flex: 0.7 }]}>Total Qty</Text>
                <Text style={[styles.tableCellHeader, { flex: 0.7 }]}>Net Qty</Text>
                <Text style={[styles.tableCellHeader, { flex: 0.8 }]}>Amount</Text>
                <Text style={[styles.tableCellHeader, { flex: userRole === 'admin' ? 1.2 : 0.8, textAlign: 'center' }]}>Actions</Text>
              </View>

              {filteredSavedBills.map((bill, index) => (
                <View key={bill.id || index} style={[styles.tableRow, index % 2 === 1 && styles.tableRowAlternate]}>
                  <View style={{ flex: 1.1 }}>
                    <Text style={styles.tableCellBold}>{bill.uniqueId || "M051026D-1"}</Text>
                    <Text style={styles.tableCellSub}>{bill.date}</Text>
                  </View>
                  <Text style={[styles.tableCell, { flex: 0.9 }]} numberOfLines={1}>{bill.caName}</Text>
                  <Text style={[styles.tableCell, { flex: 1.1 }]} numberOfLines={1}>{bill.trader}</Text>
                  <Text style={[styles.tableCell, { flex: 0.9 }]} numberOfLines={1}>{bill.commodity || '-'}</Text>
                  <Text style={[styles.tableCell, { flex: 0.7 }]}>{bill.lessQty} kg</Text>
                  <Text style={[styles.tableCell, { flex: 0.7 }]}>{bill.totalQty} kg</Text>
                  <Text style={[styles.tableCellBold, { flex: 0.7, color: '#e17055' }]}>{bill.netQty} kg</Text>
                  <Text style={[styles.tableCellBold, { flex: 0.8, color: '#00b894' }]}>Rs {bill.amount}</Text>
                  
                  <View style={{ flex: userRole === 'admin' ? 1.2 : 0.8, flexDirection: 'row', justifyContent: 'center', gap: 4 }}>
                    <TouchableOpacity style={styles.tableReprintBtn} onPress={() => handleReprintBill(bill)}>
                      <Text style={styles.tableReprintText}>Print</Text>
                    </TouchableOpacity>
                    {userRole === 'admin' && (
                      <TouchableOpacity style={styles.tableDeleteBtn} onPress={() => handleDeleteBill(bill.id)}>
                        <Text style={styles.tableDeleteText}>Delete</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}

      {/* ADMIN CA SELECT MODAL */}
      <Modal visible={adminCaSelectModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select CA Name</Text>
            {availableCAs.map(ca => (
              <TouchableOpacity key={ca} style={styles.modalItem} onPress={() => { setCaName(ca); setAdminCaSelectModalVisible(false); }}>
                <Text style={styles.modalItemText}>{ca}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setAdminCaSelectModalVisible(false)}>
              <Text style={styles.modalCloseText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

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
            <Text style={styles.modalTitle}>Select Lot ({selectedTrader} / {selectedCommodity})</Text>
            
            <ScrollView style={{ maxHeight: 300 }}>
              {selectedTrader && selectedCommodity && tenderDatabase[selectedTrader]
                ?.filter(lot => (lot.commodity || "General") === selectedCommodity)
                .map((lot, index) => (
                  <TouchableOpacity 
                    key={`${lot.lotNo}-${index}`} 
                    style={styles.modalItem}
                    onPress={() => handleSelectLot(lot)}
                  >
                    <Text style={styles.modalItemText}>
                      {lot.lotNo} ({lot.bags} Bags) - Rs {lot.price} {lot.fileName ? `[${lot.fileName}]` : ''}
                    </Text>
                  </TouchableOpacity>
                ))}
            </ScrollView>

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
  loginBtn: { paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  loginBtnText: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
  switchModeBtn: { marginTop: 12, alignItems: 'center' },
  switchModeText: { color: '#0984e3', fontSize: 13, fontWeight: 'bold' },
  container: { flex: 1, backgroundColor: '#f0f3f6' },
  tabHeader: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderColor: '#dcdde1', elevation: 3, alignItems: 'center' },
  tabButton: { flex: 1, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  activeTabButton: { borderBottomWidth: 3, borderBottomColor: '#00b894', backgroundColor: '#f8f9fa' },
  tabText: { fontSize: 12, fontWeight: '600', color: '#718093' },
  activeTabText: { color: '#00b894', fontWeight: 'bold' },
  adminUploadBtn: { backgroundColor: '#00b894', paddingVertical: 14, borderRadius: 8, alignItems: 'center' },
  adminUploadBtnText: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
  topImportBtn: { backgroundColor: '#0984e3', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 6, marginRight: 6 },
  topImportBtnLocked: { backgroundColor: '#b2bec3', opacity: 0.8 },
  topImportBtnText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  lockCornerBtn: { backgroundColor: '#ff7675', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 6, marginRight: 10 },
  lockCornerBtnText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  scrollContent: { padding: 16, paddingBottom: 40 },
  dashboardMetricRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  metricCard: { flex: 1, backgroundColor: '#fff', borderRadius: 8, padding: 12, borderWidth: 1, borderColor: '#dcdde1', alignItems: 'center' },
  metricTitle: { fontSize: 11, color: '#718093', fontWeight: '600', marginBottom: 2 },
  metricValue: { fontSize: 15, fontWeight: 'bold', color: '#00b894' },
  card: { backgroundColor: '#fff', borderRadius: 10, padding: 16, elevation: 2, marginBottom: 16 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  subLabel: { fontSize: 13, color: '#718093', fontWeight: '600', marginBottom: 4 },
  mainValue: { fontSize: 15, fontWeight: 'bold', color: '#2f3640' },
  divider: { height: 1, backgroundColor: '#f1f2f6', marginVertical: 14 },
  dropdownRow: { flexDirection: 'row', justifyContent: 'space-between' },
  dropdownSelector: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8f9fa', borderWidth: 1, borderColor: '#dcdde1', borderRadius: 8, paddingHorizontal: 16, height: 56 },
  dropdownText: { fontSize: 16, color: '#2f3640', fontWeight: '600', flex: 1 },
  dropdownArrow: { fontSize: 12, color: '#718093', marginLeft: 8 },
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
  resetBtn: { backgroundColor: '#ff7675', paddingVertical: 12, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  resetBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  printBtn: { flex: 1, backgroundColor: '#0984e3', paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  printBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  saveBtn: { flex: 1, backgroundColor: '#00b894', paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  sectionHeader: { fontSize: 14, fontWeight: 'bold', color: '#2f3640', marginBottom: 12 },
  dateFilterContainer: { marginBottom: 14, backgroundColor: '#fff', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#dcdde1' },
  searchBarInput: { height: 40, borderWidth: 1, borderColor: '#dcdde1', borderRadius: 6, paddingHorizontal: 12, backgroundColor: '#f8f9fa', fontSize: 13, color: '#2f3640' },
  filterRowTop: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
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
  tableContainer: { backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#dcdde1', overflow: 'hidden', marginBottom: 20 },
  tableRow: { flexDirection: 'row', paddingVertical: 10, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: '#f1f2f6', alignItems: 'center' },
  tableHeaderRow: { backgroundColor: '#f8f9fa', borderBottomWidth: 2, borderBottomColor: '#dcdde1' },
  tableRowAlternate: { backgroundColor: '#fcfcfc' },
  tableCellHeader: { fontSize: 11, fontWeight: 'bold', color: '#2f3640' },
  tableCell: { fontSize: 11, color: '#2f3640' },
  tableCellBold: { fontSize: 11, fontWeight: 'bold', color: '#2f3640' },
  tableCellSub: { fontSize: 9, color: '#718093' },
  tableReprintBtn: { backgroundColor: '#0984e3', paddingVertical: 5, paddingHorizontal: 8, borderRadius: 4, marginRight: 2 },
  tableReprintText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  tableDeleteBtn: { backgroundColor: '#ff7675', paddingVertical: 5, paddingHorizontal: 8, borderRadius: 4 },
  tableDeleteText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '85%', maxWidth: 400, backgroundColor: '#fff', borderRadius: 10, padding: 20 },
  modalTitle: { fontSize: 16, fontWeight: 'bold', color: '#2f3640', marginBottom: 15, textAlign: 'center' },
  modalItem: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f1f2f6' },
  modalItemText: { fontSize: 14, color: '#2f3640', fontWeight: '500' },
  modalCloseBtn: { marginTop: 15, backgroundColor: '#b2bec3', paddingVertical: 10, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
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
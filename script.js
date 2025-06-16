// --- Global Toast Bildirim Sistemi ---
let toastContainer = null;

/**
 * Ekranda bir toast bildirimi gösterir.
 * @param {string} message Gösterilecek mesaj.
 * @param {string} type 'success', 'error', veya 'info'.
 * @param {number} duration Milisaniye cinsinden ekranda kalma süresi.
 */
function showToast(message, type = 'info', duration = 14000) {
    // Konteyner DOM'da henüz yoksa bul veya oluştur.
    if (!toastContainer) {
        toastContainer = document.getElementById('toast-container');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.id = 'toast-container';
            document.body.appendChild(toastContainer);
        }
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;

    toastContainer.appendChild(toast);

    // Fade in
    setTimeout(() => {
        toast.classList.add('show');
    }, 100);

    // Fade out
    setTimeout(() => {
        toast.classList.remove('show');
        // Animasyon bittikten sonra DOM'dan kaldır
        toast.addEventListener('transitionend', () => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        });
    }, duration);
}

document.addEventListener('DOMContentLoaded', () => {
    const DEFAULT_VISIBLE_ROWS = [
        "MATRAH TOPLAMI", "HESAPLANAN KDV", "İLAVE EDİLECEK KDV", "TOPLAM KDV", "İNDİRİMLER",
        "ÖNCEKİ DÖN. DEVR. İND. KDV", "BU DÖN. AİT İND. KDV",
        "103+104+105 TOP.", "İNDİRİMLER TOPLAMI", "TECİL EDİLECEK KDV", "ÖDENMESİ GEREKEN KDV",
        "İADE EDİLMESİ GEREKEN KDV", "SONRAKİ DÖN. DEVREDEN KDV",
    ];

    // --- DOM Elementleri ---
    const dataInput = document.getElementById('dataInput');
    const processBtn = document.getElementById('processBtn');
    const addYearBtn = document.getElementById('add-year-btn');
    
    const initialInputContainer = document.getElementById('initial-input-container');
    const multiYearContainer = document.getElementById('multi-year-container');
    const tabsContainer = document.getElementById('tabs-container');
    const tabContentContainer = document.getElementById('tab-content-container');

    // --- Global State ---
    let yearlyData = {};
    let activeYear = null;

    // --- Olay Dinleyicileri ---
    processBtn.addEventListener('click', processFirstYearData);
    addYearBtn.addEventListener('click', addNewYearTab);
    
    // --- Fonksiyonlar ---

    /**
     * İlk yılın verisini işler ve sekmeli arayüzü kurar.
     */
    function processFirstYearData() {
        const inputText = dataInput.value.trim();
        if (!inputText) {
            showToast('Lütfen veri girin.', 'error');
            return;
        }

        try {
            const data = parseInput(inputText);
            const year = data.meta['YIL'];
            if (!year) throw new Error("Veri içinden 'YIL' bilgisi okunamadı.");

            console.log(`İlk yıl (${year}) veri işlendi.`);
            console.log('Orijinal veri:', data);

            yearlyData[year] = {
                original: data,
                corrected: null,
                corrections: null
            };
            activeYear = year;

            initialInputContainer.style.display = 'none';
            multiYearContainer.style.display = 'block';

            renderTabs();
            renderTabContent(year);
            switchTab(year);

            showToast(`${year} yılı verisi başarıyla işlendi ve sekme oluşturuldu.`, 'success');

        } catch (error) {
            showToast('Veri işlenirken bir hata oluştu: ' + error.message, 'error');
            console.error(error);
        }
    }
    
    /**
     * Tüm sekmeleri `yearlyData` objesine göre render eder.
     */
    function renderTabs() {
        // Mevcut sekmeleri temizle (+ butonu hariç)
        while(tabsContainer.firstChild && tabsContainer.firstChild.id !== 'add-year-btn') {
            tabsContainer.removeChild(tabsContainer.firstChild);
        }

        const years = Object.keys(yearlyData).sort();
        years.forEach(year => {
            const tab = document.createElement('div');
            tab.className = 'tab';
            tab.dataset.year = year;
            tab.textContent = `${year} Yılı`;
            tab.addEventListener('click', () => switchTab(year));
            tabsContainer.insertBefore(tab, addYearBtn);
        });
    }

    /**
     * Belirtilen yıl için sekme içeriğini oluşturur.
     */
    function renderTabContent(year) {
        if (document.getElementById(`tab-content-${year}`)) return; // Zaten varsa tekrar oluşturma

        const content = document.createElement('div');
        content.id = `tab-content-${year}`;
        content.className = 'tab-content';
        content.innerHTML = `
            <div id="originalTableContainer-${year}" class="table-container">
                <h2>Beyanın Orijinal Hali (${year})</h2>
                <div class="table-actions">
                    <button onclick="copyTable('originalTable-${year}')">Tabloyu Kopyala</button>
                </div>
                <div id="originalTable-${year}"></div>
            </div>

            <div class="form-container">
                <h2>Düzeltme İşlemleri (${year})</h2>
                <form id="correctionForm-${year}"></form>
                 <div class="form-actions">
                    <button type="button" class="reject-all-btn" data-year="${year}">Bu Döneme Ait İndirilecek KDV'nin Tamamını Aktar</button>
                    <button type="button" class="calculate-btn" data-year="${year}">Düzeltilmiş KDV Tablosu Oluştur</button>
                </div>
            </div>

            <div id="correctedTableContainer-${year}" class="table-container" style="display: none;">
                <h2>Beyanın Düzeltilmiş Hali (${year})</h2>
                <div class="table-actions">
                    <button onclick="copyTable('correctedTable-${year}')">Tabloyu Kopyala</button>
                </div>
                <div id="correctedTable-${year}"></div>
            </div>

            <div id="resenTarhTableContainer-${year}" class="table-container" style="display: none;">
                <h2>Ödenecek Re'sen Tarh Tablosu (${year})</h2>
                <div id="resenTarhTable-${year}"></div>
            </div>

            <div id="haksizIadeTableContainer-${year}" class="table-container" style="display: none;">
                <h2>Haksız İade Re'sen Tarh Tablosu (${year})</h2>
                <button onclick="copyTable('haksizIadeTable-${year}')">Tabloyu Kopyala</button>
                <div id="haksizIadeTable-${year}"></div>
            </div>
        `;
        tabContentContainer.appendChild(content);

        // Orijinal tabloyu ve düzeltme formunu göster
        displayTable(`originalTable-${year}`, yearlyData[year].original.meta, yearlyData[year].original);
        setupCorrectionForm(year);

        // Event listener for the new reject button
        content.querySelector('.reject-all-btn').addEventListener('click', (e) => {
            const yearToReject = e.target.dataset.year;
            rejectAllDeductibleVat(yearToReject);
        });

        // Event listener for the new calculate button
        content.querySelector('.calculate-btn').addEventListener('click', (e) => {
            const yearToCalc = e.target.dataset.year;
            calculateAndDisplaySingleYear(yearToCalc);
        });
    }

    /**
     * Yeni bir yıl eklemek için kullanıcıdan veri ister.
     */
    function addNewYearTab() {
        const nextYear = Object.keys(yearlyData).length > 0 ? 
            Math.max(...Object.keys(yearlyData).map(Number)) + 1 :
            new Date().getFullYear();

        const inputText = prompt(`Lütfen ${nextYear} yılına ait veriyi yapıştırın:`);
        if (!inputText) return;
        
        try {
            const data = parseInput(inputText);
            const year = data.meta['YIL'];

            console.log(`Sonraki yıl (${year}) sekmesine orijinal veri yapıştırıldı.`);
            console.log('Orijinal veri:', data);

            if(year != nextYear) {
                if(!confirm(`Girdiğiniz veri ${year} yılına ait. Beklenen yıl ${nextYear}. Yine de devam edilsin mi?`)){
                    return;
                }
            }
            if (yearlyData[year]) {
                showToast(`${year} yılına ait veri zaten mevcut.`, 'error');
                return;
            }

            yearlyData[year] = { original: data, corrected: null, corrections: null };
            
            renderTabs();
            renderTabContent(year);
            switchTab(year);

        } catch(error) {
            showToast('Veri işlenirken bir hata oluştu: ' + error.message, 'error');
        }
    }

    /**
     * Sekmeler arasında geçişi yönetir.
     */
    function switchTab(year) {
        activeYear = year;
        document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.year === year));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.toggle('active', c.id === `tab-content-${year}`));
    }

    /**
     * Tek bir yıl için hesaplama yapar ve sonuçları gösterir.
     */
    function calculateAndDisplaySingleYear(year) {
        console.log(`\n=== ${year} YILI HESAPLAMA BAŞLADI ===`);
        
        const sortedYears = Object.keys(yearlyData).sort();
        const currentYearIndex = sortedYears.indexOf(year);
        const previousYear = currentYearIndex > 0 ? sortedYears[currentYearIndex - 1] : null;
        let previousYearDevirKdv = 0;

        // Bu yılın zincirdeki ilk yıl olup olmadığını kontrol et
        const isFirstYearInChain = (previousYear === null);
        console.log(`Önceki yıl: ${previousYear}, İlk yıl mı: ${isFirstYearInChain}`);

        if (previousYear) {
            const prevYearData = yearlyData[previousYear];
            if (!prevYearData.corrected) {
                showToast(`Lütfen önce ${previousYear} yılı için hesaplama yapın.`, 'error');
                return;
            }
            const devredenKdvKey = "SONRAKİ DÖN. DEVREDEN KDV";
            const devredenKdvValues = prevYearData.corrected.table[devredenKdvKey]?.values;
            if (devredenKdvValues && devredenKdvValues.length > 0) {
                previousYearDevirKdv = devredenKdvValues[11]; // Aralık devri
                console.log(`${previousYear} yılı Aralık ayı devir KDV'si: ${previousYearDevirKdv}`);
            }
        }

        try {
            // 1. Formdan düzeltmeleri al
            const corrections = getCorrectionsFromForm(year);
            yearlyData[year].corrections = corrections;
            console.log('Düzeltmeler:', corrections);

            // 2. Yeni veriyi hesapla
            const corrected = calculateNewData(yearlyData[year].original, corrections, previousYearDevirKdv, isFirstYearInChain);
            yearlyData[year].corrected = corrected;
            console.log('Düzeltilmiş veri oluşturuldu');

            // 3. Sonuç tablolarını göster
            displayTable(`correctedTable-${year}`, corrected.meta, corrected);
            document.getElementById(`correctedTableContainer-${year}`).style.display = 'block';

            // Konsola düzeltme sonrası Ocak ayı Önceki Dönemden Devreden KDV değerini yazdır
            if (corrected.table["ÖNCEKİ DÖN. DEVR. İND. KDV"]) {
                console.log('Düzeltilmiş tablonun ' + year + '/Ocak Önceki Dönemden Devreden KDV:', corrected.table["ÖNCEKİ DÖN. DEVR. İND. KDV"].values[0]);
            }

            generateResenTarhTable(yearlyData[year].original, corrected, year);
            generateHaksizIadeTable(yearlyData[year].original, corrected, year);
            
            // Gelişmiş bildirim mantığı
            const originalYearData = yearlyData[year].original;
            const devredenKdvKey = "SONRAKİ DÖN. DEVREDEN KDV";

            const originalDevirValues = originalYearData.table[devredenKdvKey]?.values;
            const correctedDevirValues = corrected.table[devredenKdvKey]?.values;

            const originalAralikDevir = (originalDevirValues && originalDevirValues.length > 11) ? originalDevirValues[11] : 0;
            const correctedAralikDevir = (correctedDevirValues && correctedDevirValues.length > 11) ? correctedDevirValues[11] : 0;
            
            console.log(`${year} yılı Aralık ayı devir KDV'si:`);
            console.log(`- Orijinal: ${originalAralikDevir}`);
            console.log(`- Düzeltilmiş: ${correctedAralikDevir}`);
            
            const format = (num) => num.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            
            let baseMessage = `${year} yılı Düzeltilmiş KDV Tablosu Oluşturuldu!`;
            let detailsMessage = "";

            if (Math.abs(originalAralikDevir - correctedAralikDevir) > 0.01) {
                detailsMessage = ` DİKKAT: Aralık ayı Sonraki Döneme Devreden Tutarı ${format(originalAralikDevir)} TL iken ${format(correctedAralikDevir)} TL oldu.`;
            } else {
                detailsMessage = ` Aralık ayı Sonraki Döneme Devreden Tutarı değişmedi.`;
            }
            showToast(baseMessage + detailsMessage, 'success');
            
            // 4. Sonraki yıl varsa devir KDV'sini güncelle
            const nextYear = currentYearIndex < sortedYears.length - 1 ? sortedYears[currentYearIndex + 1] : null;
            if (nextYear) {
                console.log(`\nSonraki yıl (${nextYear}) güncelleme işlemi başlıyor...`);
                const nextYearData = yearlyData[nextYear];
                const oncekiDevirKey = "ÖNCEKİ DÖN. DEVR. İND. KDV";
                
                // Orijinal veriyi güncelle
                if (nextYearData.original.table[oncekiDevirKey]) {
                    const oldValue = nextYearData.original.table[oncekiDevirKey].values[0];
                    console.log(`${nextYear} yılı Ocak ayı devir KDV'si:`);
                    console.log(`- Eski değer: ${oldValue}`);
                    console.log(`- Yeni değer: ${correctedAralikDevir}`);
                    
                    nextYearData.original.table[oncekiDevirKey].values[0] = correctedAralikDevir;
                    displayTable(`originalTable-${nextYear}`, nextYearData.original.meta, nextYearData.original);
                }

                // Eğer düzeltilmiş veri varsa, onu da güncelle
                if (nextYearData.corrected && nextYearData.corrected.table[oncekiDevirKey]) {
                    const oldValue = nextYearData.corrected.table[oncekiDevirKey].values[0];
                    console.log(`${nextYear} yılı düzeltilmiş veri Ocak ayı devir KDV'si:`);
                    console.log(`- Eski değer: ${oldValue}`);
                    console.log(`- Yeni değer: ${correctedAralikDevir}`);
                    
                    nextYearData.corrected.table[oncekiDevirKey].values[0] = correctedAralikDevir;
                    displayTable(`correctedTable-${nextYear}`, nextYearData.corrected.meta, nextYearData.corrected);
                }

                showToast(`${nextYear} yılının "Önceki Dönemden Devreden KDV" tutarı güncellendi.`, 'info');
            }

            console.log(`=== ${year} YILI HESAPLAMA TAMAMLANDI ===\n`);

        } catch (error) {
            showToast(`Hesaplama sırasında bir hata oluştu (${year}): ${error.message}`, 'error');
            console.error(error);
        }
    }

    /**
     * Belirtilen yıl için Düzeltme Formunu oluşturur.
     */
    function setupCorrectionForm(year) {
        const form = document.getElementById(`correctionForm-${year}`);
        const months = yearlyData[year].original.monthOrder;

        let correctionTableHtml = `
            <div class="correction-group">
                <p>Aylara göre düzeltilecek tutarları ilgili alanlara girin.</p>
                <table class="correction-table">
                    <thead>
                        <tr>
                            <th rowspan="2">Ay</th>
                            <th>İndirilecek KDV Reddiyatı</th>
                            <th>İade KDV Reddiyatı</th>
                            <th colspan="2">Matrah Farkı</th>
                        </tr>
                        <tr>
                            <th>"Bu Döneme Ait İnd. KDV" Reddi (TL)</th>
                            <th>Haksız İade Tutarı (TL)</th>
                            <th>Matrah Farkı (TL)</th>
                            <th>KDV Oranı (%)</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        months.forEach((month, index) => {
            correctionTableHtml += `
                <tr>
                    <td>${month}</td>
                    <td><input type="number" class="correction-input" data-month="${index}" data-type="indirilecekKdvRed" placeholder="0,00" step="0.01"></td>
                    <td><input type="number" class="correction-input" data-month="${index}" data-type="iadeKdvRed" placeholder="0,00" step="0.01"></td>
                    <td><input type="number" class="correction-input" data-month="${index}" data-type="matrahFarkiAmount" placeholder="0,00" step="0.01"></td>
                    <td><input type="number" class="correction-input" data-month="${index}" data-type="matrahFarkiRate" placeholder="Örn: 20"></td>
                </tr>
            `;
        });

        correctionTableHtml += `
                    </tbody>
                    <tfoot>
                        <tr>
                            <td><strong>Toplam</strong></td>
                            <td><span id="total-indirilecekKdvRed-${year}">0,00</span></td>
                            <td><span id="total-iadeKdvRed-${year}">0,00</span></td>
                            <td><span id="total-matrahFarkiAmount-${year}">0,00</span></td>
                            <td></td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        `;

        form.innerHTML = correctionTableHtml;

        form.querySelectorAll('.correction-input').forEach(input => {
            input.addEventListener('input', () => updateCorrectionTotals(year));
        });
    }

    /**
     * Belirtilen yıl için Düzeltme Formundaki toplamları günceller.
     */
    function updateCorrectionTotals(year) {
        const totals = {
            indirilecekKdvRed: 0,
            iadeKdvRed: 0,
            matrahFarkiAmount: 0,
        };

        const form = document.getElementById(`correctionForm-${year}`);
        form.querySelectorAll('.correction-input').forEach(input => {
            const type = input.dataset.type;
            if (totals.hasOwnProperty(type)) {
                totals[type] += parseFloat(input.value) || 0;
            }
        });

        const format = (num) => num.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        
        for (const type in totals) {
            const totalEl = document.getElementById(`total-${type}-${year}`);
            if (totalEl) {
                totalEl.textContent = format(totals[type]);
            }
        }
    }

    /**
     * Belirtilen yıl için "Tamamını Reddet" butonunun işlevselliği.
     */
    function rejectAllDeductibleVat(year) {
        if (!yearlyData[year]) return;

        const buDonemIndKdvKey = "BU DÖN. AİT İND. KDV";
        const kdvValues = yearlyData[year].original.table[buDonemIndKdvKey]?.values;

        if (!kdvValues) {
            showToast(`"${buDonemIndKdvKey}" satırı veride bulunamadı.`, 'error');
            return;
        }

        const form = document.getElementById(`correctionForm-${year}`);

        form.querySelectorAll('.correction-input[data-type="indirilecekKdvRed"]').forEach(input => {
            const monthIndex = parseInt(input.dataset.month);
            input.value = kdvValues[monthIndex]?.toFixed(2) || '0.00';
        });

        form.querySelectorAll('.correction-input:not([data-type="indirilecekKdvRed"])').forEach(input => {
            input.value = '';
        });

        updateCorrectionTotals(year);
        showToast(`(${year}) yılının bütün indirimleri reddiyat kutucuklarına aktarıldı.`, 'success');
    }

    /**
     * Belirtilen yıl için formdaki düzeltme girdilerini okur.
     */
    function getCorrectionsFromForm(year) {
        const corrections = {
            indirilecekKdvRed: Array(12).fill(0),
            digerIndirimRed: Array(12).fill(0),
            iadeKdvRed: Array(12).fill(0),
            matrahFarki: Array(12).fill(0),
            hesaplananKdvFarki: Array(12).fill(0),
        };

        const form = document.getElementById(`correctionForm-${year}`);
        form.querySelectorAll('.correction-input').forEach(input => {
            const month = parseInt(input.dataset.month);
            const type = input.dataset.type;
            const value = parseFloat(input.value) || 0;

            if (isNaN(month) || value === 0) return;

            switch (type) {
                case 'indirilecekKdvRed':
                    corrections.indirilecekKdvRed[month] = value;
                    break;
                case 'iadeKdvRed':
                    corrections.iadeKdvRed[month] = value;
                    break;
                case 'matrahFarkiAmount':
                    const rateInput = form.querySelector(`.correction-input[data-month="${month}"][data-type="matrahFarkiRate"]`);
                    const rate = parseFloat(rateInput.value) || 0;
                    if (rate > 0) {
                        corrections.matrahFarki[month] = value;
                        corrections.hesaplananKdvFarki[month] = value * (rate / 100);
                    }
                    break;
                case 'matrahFarkiRate':
                    break;
            }
        });
        
        return corrections;
    }
    
    /**
     * Verilen data ile bir HTML tablosu oluşturup istenen konteynere yerleştirir. (ID'ler dinamikleşti)
     */
    function displayTable(containerId, metaData, tableData) {
        const { table, rowOrder, monthOrder } = tableData;
        const container = document.getElementById(containerId);
        if (!container) return;
        container.innerHTML = ''; 

        const formatNumber = (num) => {
            if (typeof num !== 'number') return num;
            return num.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        };

        const year = metaData['YIL'] || '';
        let metaHtml = `
            <div class="meta-info">
                <p><strong>UNVAN:</strong> ${metaData['UNVAN'] || ''}</p>
                <p><strong>VERGİ NO:</strong> ${metaData['VERGİ NO'] || ''}</p>
                <p><strong>YIL:</strong> ${year}</p>
            </div>`;

        const tableEl = document.createElement('table');
        let tableHtml = `
            <thead>
                <tr>
                    <th>DÖNEM</th>
                    ${monthOrder.map(month => `<th>${month}</th>`).join('')}
                </tr>
            </thead>
            <tbody>
        `;

        rowOrder.forEach(rowTitle => {
            const row = table[rowTitle];
            if (!row) return;

            const isVisibleByDefault = DEFAULT_VISIBLE_ROWS.includes(rowTitle) || row.isMerged;
            const rowClass = isVisibleByDefault ? '' : 'class="hidden-row"';

            tableHtml += `<tr ${rowClass}>`;
            if (row.isMerged) {
                tableHtml += `<td colspan="${monthOrder.length + 1}" class="merged-row">${rowTitle}</td>`;
            } else {
                tableHtml += `<td>${rowTitle}</td>`;
                row.values.forEach(value => {
                    tableHtml += `<td>${formatNumber(value)}</td>`;
                });
            }
            tableHtml += `</tr>`;
        });

        tableHtml += `</tbody>`;
        tableEl.innerHTML = tableHtml;
        
        container.innerHTML = metaHtml;
        container.appendChild(tableEl);

        // Add Toggle Button
        const toggleContainer = container.closest('.table-container').querySelector('.table-actions');
        if (toggleContainer) {
            const oldBtn = toggleContainer.querySelector('.toggle-visibility-btn');
            if(oldBtn) oldBtn.remove();

            const toggleButton = document.createElement('button');
            toggleButton.innerText = 'Tüm Satırları Göster';
            toggleButton.className = 'toggle-visibility-btn';
            toggleButton.onclick = () => {
                const isDefaultView = toggleButton.innerText === 'Tüm Satırları Göster';
                tableEl.querySelectorAll('.hidden-row').forEach(row => {
                    row.style.display = isDefaultView ? 'table-row' : 'none';
                });
                toggleButton.innerText = isDefaultView ? 'Varsayılan Görünüme Dön' : 'Tüm Satırları Göster';
            };
            toggleContainer.appendChild(toggleButton);
        }
    }

    /**
     * Düzeltme verilerini ve bir önceki yıldan devir KDV'yi kullanarak yeni tablo verisini hesaplar.
     */
    function calculateNewData(original, corrections, previousYearDevirKdv = 0, isFirstYearInChain = false) {
        let corrected = JSON.parse(JSON.stringify(original)); 
        let table = corrected.table;

        const ROW_KEYS = {
            MATRAH_TOPLAMI: "MATRAH TOPLAMI",
            HESAPLANAN_KDV: "HESAPLANAN KDV",
            ILAVE_KDV: "İLAVE EDİLECEK KDV",
            TOPLAM_KDV: "TOPLAM KDV",
            ONCEKI_DONEM_DEVR_KDV: "ÖNCEKİ DÖN. DEVR. İND. KDV",
            BU_DONEM_IND_KDV: "BU DÖN. AİT İND. KDV",
            INDIRIMLER_TOPLAMI: "İNDİRİMLER TOPLAMI",
            ODENMESI_GEREKEN_KDV: "ÖDENMESİ GEREKEN KDV",
            SONRAKI_DONEM_DEVR_KDV: "SONRAKİ DÖN. DEVREDEN KDV",
            IADE_KDV: "İADE EDİLMESİ GEREKEN KDV",
        };
        
        // HESAPLAMA GÜVENLİĞİ: Hesaplamada kullanılacak anahtar satırların var olduğundan emin ol.
        const ensureRowExists = (key) => {
            if (!table[key]) {
                // İlk yıl için "Önceki Dönemden Devreden KDV" satırının olmaması normaldir, uyarı gösterme.
                // Diğer durumlar için uyarı göster.
                if (!(isFirstYearInChain && key === ROW_KEYS.ONCEKI_DONEM_DEVR_KDV)) {
                    console.warn(`"${key}" satırı veride eksik. Hesaplama için 0 değerleriyle oluşturuluyor.`);
                }
                table[key] = { isMerged: false, values: Array(12).fill(0) };
            }
        };

        Object.values(ROW_KEYS).forEach(ensureRowExists);
        
        // Eğer bir önceki yıldan devir geldiyse, Ocak ayını güncelle
        if (!isFirstYearInChain) {
            console.log(`Önceki yıldan gelen devir KDV'si (${previousYearDevirKdv}) Ocak ayına aktarılıyor.`);
            table[ROW_KEYS.ONCEKI_DONEM_DEVR_KDV].values[0] = previousYearDevirKdv;
        }

        for (let i = 0; i < 12; i++) { // Ocak'tan Aralık'a
            // 1. Düzeltmeleri uygula
            table[ROW_KEYS.MATRAH_TOPLAMI].values[i] += corrections.matrahFarki[i];
            table[ROW_KEYS.HESAPLANAN_KDV].values[i] += corrections.hesaplananKdvFarki[i];
            table[ROW_KEYS.BU_DONEM_IND_KDV].values[i] -= corrections.indirilecekKdvRed[i];
            table[ROW_KEYS.IADE_KDV].values[i] -= corrections.iadeKdvRed[i];

            // 2. Yeniden hesaplama
            table[ROW_KEYS.TOPLAM_KDV].values[i] = table[ROW_KEYS.HESAPLANAN_KDV].values[i] + table[ROW_KEYS.ILAVE_KDV].values[i];

            // Önceki aydan devreden KDV'yi al. Ocak için, yıl başı devrini kullan.
            let devredenKdvOncekiAydan = (i === 0) 
                ? table[ROW_KEYS.ONCEKI_DONEM_DEVR_KDV].values[0] 
                : table[ROW_KEYS.SONRAKI_DONEM_DEVR_KDV].values[i-1];

            let indirilecekToplam = devredenKdvOncekiAydan + table[ROW_KEYS.BU_DONEM_IND_KDV].values[i];
            table[ROW_KEYS.INDIRIMLER_TOPLAMI].values[i] = indirilecekToplam;

            let fark = table[ROW_KEYS.TOPLAM_KDV].values[i] - table[ROW_KEYS.INDIRIMLER_TOPLAMI].values[i];

            if (fark >= 0) {
                table[ROW_KEYS.ODENMESI_GEREKEN_KDV].values[i] = fark;
                table[ROW_KEYS.SONRAKI_DONEM_DEVR_KDV].values[i] = 0;
            } else {
                table[ROW_KEYS.ODENMESI_GEREKEN_KDV].values[i] = 0;
                table[ROW_KEYS.SONRAKI_DONEM_DEVR_KDV].values[i] = -fark;
            }

            // Negatif iade olamaz
            if (table[ROW_KEYS.IADE_KDV].values[i] < 0) {
                table[ROW_KEYS.IADE_KDV].values[i] = 0;
            }
        }

        // Zinciri kur: Önceki Dön. Devr. İnd. KDV
        for (let i = 0; i < 12; i++) {
            if (i === 0) {
                table[ROW_KEYS.ONCEKI_DONEM_DEVR_KDV].values[0] = previousYearDevirKdv;
            } else {
                table[ROW_KEYS.ONCEKI_DONEM_DEVR_KDV].values[i] = table[ROW_KEYS.SONRAKI_DONEM_DEVR_KDV].values[i-1];
            }
        }

        return corrected;
    }
    
    /**
     * Belirtilen yıl için Re'sen Tarh tablosunu oluşturur.
     */
    function generateResenTarhTable(original, corrected, year) {
        const container = document.getElementById(`resenTarhTableContainer-${year}`);
        const tableDiv = document.getElementById(`resenTarhTable-${year}`);
        tableDiv.innerHTML = '';
        const months = original.monthOrder;
        const odenecekKdvKey = "ÖDENMESİ GEREKEN KDV";

        // Varsayılan kat
        if (!generateResenTarhTable.kat) generateResenTarhTable.kat = 1;
        let kat = generateResenTarhTable.kat;

        const tarhiyatlar = [];
        for (let i = 0; i < 12; i++) {
            const originalAmount = original.table[odenecekKdvKey]?.values[i] || 0;
            const correctedAmount = corrected.table[odenecekKdvKey]?.values[i] || 0;
            const fark = correctedAmount - originalAmount;

            if (fark > 0.01) {
                tarhiyatlar.push({
                    month: months[i],
                    original: originalAmount,
                    corrected: correctedAmount,
                    fark: fark
                });
            }
        }

        if (tarhiyatlar.length > 0) {
            const metaData = original.meta;
            const year = metaData['YIL'] || '';
            let fullHtml = `<div class="meta-info" style="display: none;"><p><strong>YIL:</strong> ${year}</p></div>`;

            // Butonlar
            fullHtml += `
                <div style="margin-bottom:10px;display:flex;gap:10px;align-items:center;">
                    <button id="copy-resen-btn-${year}" class="kat-btn" style="background:#2980b9;color:#fff;">Tabloyu Kopyala</button>
                    <button id="kat1-btn-${year}" class="kat-btn" style="background:#27ae60;color:#fff;">1 KAT</button>
                    <button id="kat3-btn-${year}" class="kat-btn" style="background:#e74c3c;color:#fff;">3 KAT</button>
                </div>
            `;

            const format = (num) => num.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            let tableHtml = `
                <table>
                    <thead>
                        <tr>
                            <th>DÖNEM</th>
                            <th>BEYAN EDİLEN ÖDENECEK KDV</th>
                            <th>OLMASI GEREKEN ÖDENECEK KDV</th>
                            <th>RE'SEN TARH EDİLECEK KDV</th>
                            <th id="vergi-cezasi-header-${year}">VERGİ ZİYAI CEZASI (${kat} Kat)</th>
                        </tr>
                    </thead>
                    <tbody>
            `;
            tarhiyatlar.forEach(t => {
                tableHtml += `
                    <tr>
                        <td>${t.month}</td>
                        <td>${format(t.original)}</td>
                        <td>${format(t.corrected)}</td>
                        <td>${format(t.fark)}</td>
                        <td class="vergi-cezasi-cell">${format(t.fark * kat)}</td>
                    </tr>
                `;
            });
            tableHtml += `
                    </tbody>
                    <tfoot>
                        <tr>
                            <td><strong>TOPLAM</strong></td>
                            <td><strong>${format(tarhiyatlar.reduce((sum, t) => sum + t.original, 0))}</strong></td>
                            <td><strong>${format(tarhiyatlar.reduce((sum, t) => sum + t.corrected, 0))}</strong></td>
                            <td><strong>${format(tarhiyatlar.reduce((sum, t) => sum + t.fark, 0))}</strong></td>
                            <td class="vergi-cezasi-cell"><strong>${format(tarhiyatlar.reduce((sum, t) => sum + t.fark * kat, 0))}</strong></td>
                        </tr>
                    </tfoot>
                </table>
            `;
            fullHtml += tableHtml;
            tableDiv.innerHTML = fullHtml;
            container.style.display = 'block';

            // Butonlara event ekle
            setTimeout(() => {
                const btnCopy = document.getElementById(`copy-resen-btn-${year}`);
                const btn1 = document.getElementById(`kat1-btn-${year}`);
                const btn3 = document.getElementById(`kat3-btn-${year}`);
                if (btnCopy) btnCopy.onclick = () => copyTable(`resenTarhTable-${year}`);
                if (btn1) btn1.onclick = () => {
                    generateResenTarhTable.kat = 1;
                    generateResenTarhTable(original, corrected, year);
                };
                if (btn3) btn3.onclick = () => {
                    generateResenTarhTable.kat = 3;
                    generateResenTarhTable(original, corrected, year);
                };
            }, 0);
        } else {
            container.style.display = 'none';
        }
    }

    /**
     * Belirtilen yıl için Haksız İade tablosunu oluşturur.
     */
    function generateHaksizIadeTable(original, corrected, year) {
        const container = document.getElementById(`haksizIadeTableContainer-${year}`);
        const tableDiv = document.getElementById(`haksizIadeTable-${year}`);
        const months = original.monthOrder;
        const iadeKdvKey = "İADE EDİLMESİ GEREKEN KDV";
        
        const haksizIadeler = [];
        for (let i = 0; i < 12; i++) {
            const originalAmount = original.table[iadeKdvKey]?.values[i] || 0;
            const correctedAmount = corrected.table[iadeKdvKey]?.values[i] || 0;
            const fark = originalAmount - correctedAmount;

            if (fark > 0.01) {
                haksizIadeler.push({
                    month: months[i],
                    fark: fark
                });
            }
        }

        if (haksizIadeler.length > 0) {
            const metaData = original.meta;
            const year = metaData['YIL'] || '';
            let fullHtml = `<div class="meta-info" style="display: none;"><p><strong>YIL:</strong> ${year}</p></div>`;

            let tableHtml = `
                <table>
                    <thead>
                        <tr>
                            <th>Dönem</th>
                            <th>Fark (Haksız İade) (TL)</th>
                        </tr>
                    </thead>
                    <tbody>
            `;
            haksizIadeler.forEach(t => {
                tableHtml += `
                    <tr>
                        <td>${t.month}</td>
                        <td>${format(t.fark)}</td>
                    </tr>
                `;
            });
            tableHtml += `</tbody></table>`;
            fullHtml += tableHtml;
            
            tableDiv.innerHTML = fullHtml;
            container.style.display = 'block';
        } else {
            container.style.display = 'none';
        }
    }

    /**
     * Girdiyi parse edip metadata ve tablo verisini ayıran fonksiyon.
     */
    function parseInput(text) {
        const lines = text.split('\n').filter(line => line.trim() !== '');
        if (lines.length < 10) throw new Error("Veri formatı geçersiz veya eksik.");

        const meta = {};
        for (let i = 0; i < 6; i++) {
            const parts = lines[i].split(/:\s+/);
            const key = parts[0].replace(/:$/, '').trim();
            const value = parts.slice(1).join(': ').trim();
            meta[key] = value;
        }

        const headerRowIndex = lines.findIndex(line => line.startsWith('DÖNEM'));
        if (headerRowIndex === -1) throw new Error("Tablo başlık satırı (DÖNEM) bulunamadı.");

        const separator = /\t|\s{2,}/;
        const monthOrder = lines[headerRowIndex].split(separator).slice(1).map(m => m.trim());
        if (monthOrder.length !== 12) throw new Error(`Aylar tam olarak okunamadı. 12 ay olmalı. Bulunan: ${monthOrder.length}`);

        const table = {};
        const rowOrder = [];

        const mergedRows = [
            "İNDİRİMLER", "İHRAÇ KAYDIYLA TESLİMLER", "KISMİ İSTİSNA KAP. GİREN İŞLEMLER",
            "TAM İSTİSNA KAP. GİREN İŞLEMLER", "DİĞER İADE HAKKI DOĞURAN İŞLEMLER",
            "SONUÇ HESAPLARI", "DİĞER BİLGİLER"
        ];
        
        const parseNumber = (str) => {
            if (!str) return 0;
            return parseFloat(str.replace(/\./g, '').replace(',', '.')) || 0;
        };

        for (let i = headerRowIndex + 1; i < lines.length; i++) {
            const line = lines[i].trim();
            
            const splitIndex = line.search(separator);
            if (splitIndex === -1) { 
                 if (mergedRows.includes(line)) {
                    if (!table[line]) {
                        table[line] = { isMerged: true, values: [] };
                        rowOrder.push(line);
                    }
                }
                continue;
            }

            let rowTitle = line.substring(0, splitIndex).trim();
            if (rowTitle === "ÖNCEKİ DÖNEMDEN DEVREDEN KDV" || rowTitle === "ÖNCEKİ DÖN. DEVR. İND. KDV") {
                rowTitle = "ÖNCEKİ DÖN. DEVR. İND. KDV";
            }
            if (rowTitle.startsWith("BU DÖN. AİT İND. KDV")) {
                rowTitle = "BU DÖN. AİT İND. KDV";
            }

            const valuesString = line.substring(splitIndex).trim();
            const values = valuesString.split(separator).map(parseNumber);
            
            if (values.length > 0 && rowTitle) {
                 if (!table[rowTitle]) {
                    table[rowTitle] = { isMerged: false, values: values };
                    rowOrder.push(rowTitle);
                }
            }
        }
        
        return { meta, table, rowOrder, monthOrder };
    }

});

/**
 * Bir HTML tablosunu panoya kopyalamak için genel fonksiyon. (ID'ler dinamikleşti)
 */
function copyTable(tableContainerId) {
    const tableContainer = document.getElementById(tableContainerId);
    if (!tableContainer) {
         console.error("Kopyalanacak tablo konteyneri bulunamadı:", tableContainerId);
         return;
    }
    const sourceTable = tableContainer.querySelector('table');
    if (!sourceTable) return;

    const dataMatrix = [];
    const sourceRows = sourceTable.querySelectorAll('thead tr, tbody tr, tfoot tr');

    sourceRows.forEach(row => {
        const isVisible = window.getComputedStyle(row).display !== 'none';
        const isMergedRow = row.querySelector('.merged-row');
        if (!isVisible || isMergedRow) {
            return;
        }

        const rowData = [];
        row.querySelectorAll('th, td').forEach(cell => {
            rowData.push(cell.innerText);
        });
        dataMatrix.push(rowData);
    });

    const metaInfoDiv = tableContainer.querySelector('.meta-info');
    let year = '';
    if (metaInfoDiv) {
        const p = Array.from(metaInfoDiv.querySelectorAll('p')).find(p => p.textContent.includes('YIL:'));
        if (p) {
             year = p.textContent.replace('YIL:', '').trim();
        }
    }
    
    if (year && dataMatrix.length > 0 && dataMatrix[0][0] && dataMatrix[0][0].toUpperCase() === 'DÖNEM') {
        dataMatrix[0][0] = `DÖNEM (${year})`;
    }

    if (dataMatrix.length < 2 && !tableContainerId.includes('resenTarh') && !tableContainerId.includes('haksizIade')) {
        showToast("Kopyalanacak veri bulunamadı.", 'error');
        return;
    }

    const columnsToFilterIfZero = [
        'İLAVE EDİLECEK KDV', /*'ÖNCEKİ DÖN. DEVR. İND. KDV',*/
        '103+104+105 TOP.', 'TECİL EDİLECEK KDV', 'İADE EDİLMESİ GEREKEN KDV'
    ];
    
    const headerRowFromMatrix = dataMatrix[0] || [];
    const bodyRowsFromMatrix = dataMatrix.slice(1);

    const filteredBodyRows = bodyRowsFromMatrix.filter(row => {
        const header = row[0];
        if (!columnsToFilterIfZero.includes(header)) {
            return true; 
        }
        
        const values = row.slice(1);
        const allAreZero = values.every(val => {
            const num = parseFloat(val.replace(/\./g, '').replace(',', '.')) || 0;
            return num === 0;
        });
        
        return !allAreZero;
    });

    let finalMatrix = [headerRowFromMatrix, ...filteredBodyRows];

    const noTransposeIds = ['resenTarhTable', 'haksizIadeTable'];
    const shouldTranspose = !noTransposeIds.some(id => tableContainerId.includes(id));

    if (shouldTranspose) {
         if (finalMatrix.length < 2) {
            showToast("Filtreleme sonrası kopyalanacak veri bulunamadı.", 'error');
            return;
        }
        finalMatrix = finalMatrix[0].map((_, i) => finalMatrix.map(row => row[i]));
    }
   
    const tempContainer = document.createElement('div');
    tempContainer.style.position = 'absolute';
    tempContainer.style.left = '-9999px';
    
    const newTable = document.createElement('table');
    newTable.style.borderCollapse = 'collapse';
    newTable.style.fontFamily = 'Times New Roman';
    newTable.style.fontSize = '7pt';
    newTable.style.width = '100%';

    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    headerRow.style.pageBreakInside = 'avoid';
    (finalMatrix[0] || []).forEach(headerText => {
        const th = document.createElement('th');
        th.innerText = headerText;
        th.style.border = '1px solid black';
        th.style.padding = '2px 4px';
        th.style.backgroundColor = '#f2f2f2';
        th.style.fontWeight = 'bold';
        th.style.textAlign = 'center';
        headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    newTable.appendChild(thead);

    const tbody = document.createElement('tbody');
    const bodyRows = finalMatrix.slice(1);
    bodyRows.forEach(rowData => {
        const newRow = document.createElement('tr');
        newRow.style.pageBreakInside = 'avoid';
        
        rowData.forEach((cellText, j) => {
            const td = document.createElement('td');
            td.innerText = cellText;
            td.style.border = '1px solid black';
            td.style.padding = '2px 4px';
            td.style.textAlign = (j === 0 && shouldTranspose) ? 'left' : 'right';
            if (j === 0 && shouldTranspose) {
                td.style.fontWeight = 'bold';
                td.style.backgroundColor = '#f8f9fa';
            }
            newRow.appendChild(td);
        });
        tbody.appendChild(newRow);
    });
    
    newTable.appendChild(tbody);
    tempContainer.appendChild(newTable);
    document.body.appendChild(tempContainer);

    const range = document.createRange();
    range.selectNode(newTable);
    window.getSelection().removeAllRanges();
    window.getSelection().addRange(range);
    
    try {
        const successful = document.execCommand('copy');
        const msg = successful ? 'başarılı' : 'başarısız';
        showToast(`Tablo kopyalama ${msg}.`, successful ? 'success' : 'error');
    } catch (err) {
        showToast('Kopyalama sırasında bir hata oluştu.', 'error');
    }

    window.getSelection().removeAllRanges();
    document.body.removeChild(tempContainer);
} 
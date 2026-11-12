
const dateInput = document.getElementById("bookingDate");
const timeGrid = document.getElementById("timeGrid");
const dateNote = document.getElementById("dateNote");
const timeNote = document.getElementById("timeNote");
const confirmButton = document.getElementById("confirmButton");
const toast = document.getElementById("toast");

let selectedTime = "";
let toastTimer;

const times = Array.from({ length: 13 }, (_, i) =>
    String(i + 8).padStart(2, "0") + ":00"
);

function rupiah(value) {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        maximumFractionDigits: 0
    }).format(Number(value) || 0);
}

function getCart() {
    try {
        return JSON.parse(sessionStorage.getItem("computerfix_cart")) || [];
    } catch {
        return [];
    }
}

function showToast(message) {
    toast.textContent = message;
    toast.classList.add("show");

    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
        toast.classList.remove("show");
    }, 2600);
}

function getToday() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

dateInput.min = getToday();

function isWeekday(dateString) {
    if (!dateString) return false;

    const day = new Date(dateString + "T12:00:00").getDay();
    return day >= 1 && day <= 5;
}

function formatDate(dateString) {
    if (!dateString) return "Belum dipilih";

    return new Date(dateString + "T12:00:00")
        .toLocaleDateString("id-ID", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric"
        });
}

function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}

async function renderTimes() {
    const date = dateInput.value;

    selectedTime = "";
    document.getElementById("summaryTime").textContent = "Belum dipilih";
    timeGrid.innerHTML = "";

    if (!date) {
        dateNote.textContent = "Pilih tanggal kunjungan terlebih dahulu.";
        timeNote.textContent = "Pilih tanggal untuk melihat jadwal.";
        return;
    }

    if (date < getToday()) {
        dateNote.textContent = "Tanggal tidak boleh sudah lewat.";
        timeNote.textContent = "Pilih tanggal lain.";
        return;
    }

    if (!isWeekday(date)) {
        dateNote.textContent = "Booking hanya tersedia Senin–Jumat.";
        timeNote.textContent = "Pilih tanggal pada hari kerja.";
        return;
    }

    dateNote.textContent = "Tanggal dipilih: " + formatDate(date);
    timeNote.textContent = "Memeriksa jadwal...";

    try {
        const response = await fetch(
            `../backend/cek_jadwal.php?tanggal=${encodeURIComponent(date)}`
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.message || "Gagal mengambil jadwal.");
        }

        if (dateInput.value !== date) return;

        const terisi = data.terisi || [];

        timeGrid.innerHTML = times.map(time => {
            const booked = terisi.includes(time);

            return `
                <button
                    type="button"
                    class="time-slot ${booked ? "taken" : ""}"
                    data-time="${time}"
                    ${booked ? "disabled" : ""}
                >
                    ${time}
                    <small>${booked ? "Terisi" : "Tersedia"}</small>
                </button>
            `;
        }).join("");

        timeNote.textContent =
            "Pilih salah satu jam yang masih tersedia.";
    } catch (error) {
        console.error(error);
        timeNote.textContent =
            "Jadwal gagal dimuat. Periksa koneksi PHP dan database.";
        showToast("Gagal mengambil jadwal dari database.");
    }
}

function renderSummary() {
    const cart = getCart();

    const quantity = cart.reduce(
        (sum, item) => sum + Number(item.jumlah || 0), 0
    );

    const subtotal = cart.reduce(
        (sum, item) =>
            sum + Number(item.harga || 0) * Number(item.jumlah || 0),
        0
    );

    document.getElementById("cartCount").textContent = quantity;
    document.getElementById("summaryDate").textContent =
        formatDate(dateInput.value);
    document.getElementById("summaryQuantity").textContent =
        quantity + " unit";
    document.getElementById("summaryTotal").textContent =
        rupiah(subtotal);

    document.getElementById("summaryItems").innerHTML = cart.length
        ? cart.map(item => `
            <div class="summary-item">
                <span>${escapeHTML(item.nama)} × ${Number(item.jumlah)}</span>
                <strong>
                    ${rupiah(Number(item.harga) * Number(item.jumlah))}
                </strong>
            </div>
        `).join("")
        : "<p class='no-items'>Belum ada sparepart di keranjang.</p>";
}

timeGrid.addEventListener("click", event => {
    const button = event.target.closest("button[data-time]");

    if (!button || button.disabled) return;

    selectedTime = button.dataset.time;

    document.querySelectorAll(".time-slot").forEach(slot => {
        slot.classList.remove("selected");
    });

    button.classList.add("selected");
    document.getElementById("summaryTime").textContent = selectedTime;
});

dateInput.addEventListener("change", () => {
    renderTimes();
    renderSummary();
});

confirmButton.addEventListener("click", async () => {
    const nama = document.getElementById("customerName").value.trim();
    const noHp = document.getElementById("customerPhone").value.trim();
    const catatan = document.getElementById("bookingNote").value.trim();
    const tanggal = dateInput.value;
    const cart = getCart();

    if (!nama || !noHp) {
        showToast("Isi nama dan nomor HP terlebih dahulu.");
        return;
    }

    if (!/^[0-9+\-\s()]{8,20}$/.test(noHp)) {
        showToast("Format nomor HP tidak valid.");
        return;
    }

    if (catatan.length > 500) {
        showToast("Catatan maksimal 500 karakter.");
        return;
    }

    if (!tanggal || tanggal < getToday() || !isWeekday(tanggal)) {
        showToast("Pilih tanggal kerja yang valid.");
        return;
    }

    if (!selectedTime) {
        showToast("Pilih jam booking terlebih dahulu.");
        return;
    }

    const invalidItem = cart.some(item =>
        !item.nama ||
        !Number.isFinite(Number(item.harga)) ||
        Number(item.harga) < 0 ||
        !Number.isInteger(Number(item.jumlah)) ||
        Number(item.jumlah) < 1 ||
        Number(item.jumlah) > 99
    );

    if (invalidItem) {
        showToast("Data sparepart di keranjang tidak valid.");
        return;
    }

    confirmButton.disabled = true;
    confirmButton.textContent = "Menyimpan booking...";

    try {
        const response = await fetch("../backend/simpan_booking.php", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                nama,
                no_hp: noHp,
                catatan,
                tanggal,
                jam: selectedTime,
                barang: cart
            })
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            showToast(data.message || "Booking gagal disimpan.");

            if (response.status === 409) {
                renderTimes();
            }

            return;
        }

        sessionStorage.removeItem("computerfix_cart");

        // simpan kode booking di browser agar muncul di halaman Histori
        try {
            const codes = JSON.parse(
                localStorage.getItem("computerfix_booking_codes")
            ) || [];
            codes.push(data.kode_booking);
            localStorage.setItem(
                "computerfix_booking_codes",
                JSON.stringify(codes)
            );
        } catch (e) { /* abaikan */ }

        // SELALU ke halaman pembayaran, kecuali server bilang gratis
        if (data.perlu_bayar === false) {
            sessionStorage.setItem(
                "computerfix_flash",
                "Booking " + data.kode_booking + " berhasil dibuat."
            );
            window.location.href = "../HISTORI%20PAGE/index.html";
        } else {
            window.location.href =
                "../PAYMENT%20PAGE/index.html?kode=" +
                encodeURIComponent(data.kode_booking);
        }
        return;

    } catch (error) {
        console.error(error);
        showToast(
            "Gagal terhubung ke server. Buka website lewat localhost."
        );
    } finally {
        confirmButton.disabled = false;
        confirmButton.textContent = "Konfirmasi Booking →";
    }
});

renderTimes();
renderSummary();

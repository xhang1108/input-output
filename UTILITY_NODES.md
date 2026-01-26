# 🛠️ Calctopus Utility Nodes (工具與輔助節點)

這份表格列出了所有 **非數學核心** 的輔助節點。這些節點負責數據轉換、視覺化、邏輯控制與用戶交互，是實現「加油站」、「保險」等真實場景的關鍵膠水。

## 📊 節點規格表

| ID | 節點名稱 | 類別 | 輸入 (In) | 輸出 (Out) | 核心功能 | 應用場景 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **U1** | **Template (模板)** | UX/Text | Variables `a`, `b`... | String | 將數值嵌入文字模板 (`Save ${a}`) | 給出「建議買入」或「省下 $50」的人話建議。 |
| **U2** | **Convert (單位轉換)** | Physics | Value (with Unit) | Value (New Unit) | 物理量單位換算 (`km` -> `mile`) | 跨境購物時的幣值或長度轉換。 |
| **U3** | **Switch (邏輯開關)** | Control | `Condition`, `TrueVal`, `FalseVal` | Value | 基於條件選擇數據流向 (If-Else) | 「如果 A < B，則顯示 A，否則 B」。 |
| **U4** | **Input (Label)** | I/O | User Input | Number/Unit | **帶有重命名功能** 的基礎輸入框 | 可命名為「油價」、「稅率」等具體業務名稱。 |
| **U5** | **Result (Label)** | I/O | Number | Display | **帶有重命名功能** 的結果顯示器 | 顯示「最終獲利」、「預期壽命」等結論。 |
| **U6** | **Plot (繪圖)** | Visual | Array `x`, Array `y` | Chart UI | 繪製 2D 折線圖/散點圖 | 保險場景：根據年齡 (X) 繪製保費 (Y) 曲線。 |
| **U7** | **Range (數列)** | Generator | `Start`, `End`, `Step` | Array | 生成等差數列 (`0, 1, ... 10`) | 作為繪圖節點的 X 軸輸入。 |
| **U8** | **Debug (數據探針)** | DevTool | Any | Pass-through | 顯示當前連線的所有屬性 (Type, Shape) | 用於專家模式 debug 複雜公式。 |

---

## 🔗 原子化組合範例 (Atomic Recipes)

### 1. 人話建議機 (The Advisor)
*   **目標**：計算並告訴用戶是否該去 B 國買。
*   **組合**：
    1.  `Compare Node`: 計算 `LocalPrice > ImportPrice` -> 得到 `True/False`。
    2.  `Template Node`: 輸入 `True/False`。
        *   模板邏輯：(需配合 Switch 使用，或 Template 支援簡單三元運算)
        *   或者：`Switch Node` 選擇兩個字串："建議海淘" / "建議本地買"。

### 2. 單位換算器 (The Converter)
*   **目標**：將 5 miles 轉換為 km。
*   **組合**：
    1.  `Input Node`: 輸入 `5`，單位選 `mile`。
    2.  `Convert Node`: 目標單位設為 `km`。
    3.  `Result Node`: 顯示 `8.04 km`。

### 3. 保險盈虧圖 (The Risk Chart)
*   **目標**：畫出 0-100 歲的保費累積圖。
*   **組合**：
    1.  `Range Node`: 0 到 100 (代表歲數)。
    2.  `Math Node`: 計算 `歲數 * 年保費` (Map 操作)。
    3.  `Plot Node`: X接歲數，Y接累積保費。

---

## 🚫 禁止事項 (Constraints)
1.  **禁止隱藏邏輯**：Template Node 只負責拼字，不負責計算。請在外部算好再連進來。
2.  **禁止多合一**：不要做一個 "Plot and Calculate" 節點。計算歸計算，繪圖歸繪圖。

Unpacking Social Exposure
=========================

Data repository: https://cepheusl.github.io/social_exposure_web/data.html
Files:
  (i)  osf_social_expo_firm_quarter_2003_2025q1.csv
  (ii) osf_social_expo_firm_year_2003_2025q1.csv
Last updated: 2026 Jan
Time coverage: 2003Q1 to 2025Q1


1. Overview
-----------
This dataset provides quarterly and annual firm-level measures of exposure to social issues for a global sample of firms from 2003Q1 to 2025Q1. The measures capture the share of firms' earnings conference calls devoted to social discussions. Social exposure is reported both as an overall measure and decomposed into five social topics: Employee Welfare, DEI, Stakeholder Outreach, Ethical Commitments, and Crisis Response.


2. Unit of observation and structure
-----------------------------------
Unit of observation:
  - File (i): firm-quarter
  - File (ii): firm-year

Time variables:
  - File (i): yearquarter, encoded as a YYYYQ# string (e.g., 2003Q3)
  - File (ii): year, encoded as a 4-digit integer (YYYY)

Firm identifiers:
  - Primary identifier: gvkey
  - Additional identifiers included for matching to other datasets: isin, cusip, ric


3. Variable construction and definitions
----------------------------------------
Exposure variables use the suffix "_expo" and a prefix indicating the topic:

  - social_expo: overall exposure to social issues
  - emp_expo: Employee Welfare exposure
  - dei_expo: DEI exposure
  - stakeholder_expo: Stakeholder Outreach exposure
  - ethical_expo: Ethical Commitments exposure
  - crisis_expo: Crisis Response exposure

All exposure measures are computed as follows. For a given firm and period, the measure equals:

  (number of sentences classified as social, for the relevant topic) /
  (total number of sentences in the firm's earnings conference calls)

The resulting ratio is multiplied by 1000 for interpretability.

Social sentences and topic membership are identified using a two-stage dictionary plus LLM approach. For a detailed description of the variable construction, topic discovery and classification, please consult the methodology section of the paper cited in Section 4.

Additional variables:
  - hqcountrycode: headquarters country code
  - sic: Standard Industrial Classification (SIC) industry code (4-digit)


4. Citation
---------------------------------------
Please cite the following study when using this Social Exposure dataset:

  Liu, Mingyang and Sautner, Zacharias and van Lent, Laurence and Zhang, Ruishen, Unpacking Social Exposure (May 15, 2026). TRR 266 Accounting for Transparency Working Paper Series No. 235, HKU Jockey Club Enterprise Sustainability Global Research Institute Paper No. 2026/087, Available at SSRN: https://ssrn.com/abstract=6770779 or http://dx.doi.org/10.2139/ssrn.6770779

The data are publicly available and free to use, provided that the data source is acknowledged as follows:

  M. Liu, Z. Sautner, L. van Lent, and R. Zhang. ”Data for ‘Unpacking Social Exposure’”. https://cepheusl.github.io/social_exposure_web/data.html

Please cite both the dataset and the associated paper in any work that uses these resources.

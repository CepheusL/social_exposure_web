Firm-Level Climate Change Exposure
==================================

Data repository: https://cepheusl.github.io/social_exposure_web/climate/data.html
Files:
  (i)  firmquarter_score_2024Q4_Version_2025_Jul_03.csv
  (ii) firmyear_score_2024Q4_Version_2025_Jul_03.csv
Version: 2025 Jul 03
Time coverage: 2001Q1 to 2024Q4

Please read this document in full before using the data. These details matter for using it correctly.


1. Overview
-----------
This dataset provides quarterly and annual firm-level measures of climate change exposure, risk and sentiment for a global sample of firms from 2001Q1 to 2024Q4. The measures come from the conversation on firms' earnings conference calls. They cover climate change as a whole and three climate change topics: opportunities, regulatory shocks and physical shocks.


2. Unit of observation and structure
-----------------------------------
Unit of observation:
  - File (i): firm-quarter
  - File (ii): firm-year

Time variables:
  - File (i): year (YYYY) and quarter (1 to 4)
  - File (ii): year (YYYY)

Firm identifiers:
  - Primary identifier: isin (each isin appears once per period)
  - Additional identifiers for matching to other datasets: gvkey, cusip

Additional variables:
  - hqcountrycode: headquarters country code (ISO 3166-1 alpha-2)


3. Variable construction and definitions
----------------------------------------
Each score variable name has three parts, for example cc_expo_ew.

The first part is the topic:
  - cc: climate change as a whole
  - op: opportunities related to climate change
  - rg: regulatory shocks related to climate change
  - ph: physical shocks related to climate change

The second part is the metric:
  - expo: exposure
  - risk: risk
  - pos: positive sentiment
  - neg: negative sentiment
  - sent: net sentiment

The third part is the weighting of the climate change bigrams. All scores in these files weight each bigram equally (ew).

Exposure counts how often climate change bigrams occur in the transcript, scaled by the total number of bigrams in the transcript. The bigrams come from a machine learning keyword discovery algorithm (King, Lam and Roberts, 2017) that starts from a short list of initial climate change bigrams. The topic measures use the opportunity, regulatory and physical climate change bigrams. These three sets do not overlap and each is part of the overall set, so the three topic exposures add up to at most cc_expo_ew.

Risk counts the climate change bigrams that appear in the same sentence as the words "risk" or "uncertainty" or their synonyms, scaled by the total number of bigrams in the transcript.

Positive and negative sentiment count the climate change bigrams conditional on the positive or negative tone words of Loughran and McDonald (2011) in the same sentence, scaled by the total number of bigrams in the transcript. Negative sentiment (neg) is stored as a negative number. Net sentiment (sent) equals pos plus neg.

Following Hassan et al. (2019), the sentiment and risk measures can be read as components of the exposure measures.

All scores are shares of the transcript's bigrams. The paper multiplies them by 1,000 in its tables, and so does the website. A value of 0.001 in the files equals one climate change bigram per 1,000 bigrams.

Annual scores are averages over the firm's earnings calls in the year. For an extensive description of the data and the method, please read the data and methodology sections of the paper cited in Section 4.


4. Citation
-----------
Please cite the following study when using this Climate Change Exposure, Risk and Sentiment data:

  Sautner, Zacharias, Laurence van Lent, Grigory Vilkov, and Ruishen Zhang. "Firm-Level Climate Change Exposure." The Journal of Finance 78, no. 3 (2023): 1449-1498. https://doi.org/10.1111/jofi.13219

The data are publicly available and free to use, provided that the data source is acknowledged as follows:

  Z. Sautner, L. van Lent, G. Vilkov, and R. Zhang. "Data for 'Firm-Level Climate Change Exposure'". https://cepheusl.github.io/social_exposure_web/climate/data.html

Please cite both the dataset and the associated paper in any work that uses these resources.

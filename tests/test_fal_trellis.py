import unittest

from src.fal_trellis import PRICE_USD


class FalPricingTest(unittest.TestCase):
    def test_all_supported_resolutions_have_prices(self):
        self.assertEqual(PRICE_USD, {"512": 0.25, "1024": 0.30, "1536": 0.35})


if __name__ == "__main__":
    unittest.main()

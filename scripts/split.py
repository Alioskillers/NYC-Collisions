import pandas as pd

input_file = "../data/raw/integrated.csv"      # full 2GB file
output_file = "integrated_10k.csv"
sample_size = 10000

# Count rows first (without loading full CSV)
print("Counting rows...")
total_rows = sum(1 for _ in open(input_file, "r")) - 1  # minus header
print(f"Total rows: {total_rows}")

# Calculate sampling fraction
frac = sample_size / total_rows

print("Sampling rows...")

# Chunked sampling (memory safe)
sampled_chunks = []
chunk_size = 200000  # adjust if needed for speed

reader = pd.read_csv(input_file, chunksize=chunk_size)

for chunk in reader:
    sampled = chunk.sample(frac=frac, random_state=42)
    sampled_chunks.append(sampled)

# Combine into one DataFrame
full_sample = pd.concat(sampled_chunks, ignore_index=True)

# Ensure exactly 10k rows (in case rounding varies)
full_sample = full_sample.sample(n=sample_size, random_state=42)

# Save output
full_sample.to_csv(output_file, index=False)

print(f"Saved sample: {output_file}")
print(f"Rows: {len(full_sample)}")